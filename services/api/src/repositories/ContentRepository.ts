import { and, asc, eq, inArray } from "drizzle-orm";
import type { CreateContentUnitInput } from "../domain/ContentModels.js";
import { AppError } from "../domain/AppError.js";
import type { LicenseStatus } from "../domain/Enums.js";
import type { EntityId } from "../domain/EntityId.js";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import {
  audioAssets,
  contentUnits,
  ingestionJobs,
  speakingPrompts,
  syncedSegments,
  targetSentences,
  transcriptSegments,
} from "../infrastructure/database/schema.js";
import type { SyncedSegmentDraft } from "../providers/TranscriptSyncProvider.js";

export class ContentRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly idGenerator: SnowflakeIdGenerator,
  ) {}

  async createDraft(input: CreateContentUnitInput): Promise<EntityId> {
    const now = this.idGenerator.now();
    const contentUnitId = this.idGenerator.nextId();
    const [unit] = await this.db
      .insert(contentUnits)
      .values({
        id: contentUnitId,
        title: input.title,
        expression: input.expression,
        expressionMeaning: input.expressionMeaning,
        difficulty: input.difficulty,
        sceneTags: input.sceneTags,
        estimatedMinutes: input.estimatedMinutes,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl ?? null,
        licenseStatus: input.licenseStatus ?? "unknown",
        publishStatus: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: contentUnits.id });

    if (!unit) {
      throw new AppError("upstream_failed", "Failed to create content unit");
    }

    if (input.audioAsset) {
      await this.db.insert(audioAssets).values({
        id: this.idGenerator.nextId(),
        contentUnitId: unit.id,
        ...input.audioAsset,
        createdAt: now,
        updatedAt: now,
      });
    }

    const segmentIdByClientId = new Map<EntityId, EntityId>();
    for (const segment of input.transcriptSegments ?? []) {
      const transcriptSegmentId = this.idGenerator.nextId();
      const [created] = await this.db
        .insert(transcriptSegments)
        .values({
          id: transcriptSegmentId,
          contentUnitId: unit.id,
          englishText: segment.englishText,
          chineseText: segment.chineseText ?? null,
          speaker: segment.speaker ?? null,
          segmentOrder: segment.segmentOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: transcriptSegments.id });
      if (created && segment.segmentId) {
        segmentIdByClientId.set(segment.segmentId, created.id);
      }
    }

    for (const targetSentence of input.targetSentences ?? []) {
      await this.db.insert(targetSentences).values({
        id: this.idGenerator.nextId(),
        contentUnitId: unit.id,
        englishText: targetSentence.englishText,
        chinesePrompt: targetSentence.chinesePrompt,
        includesExpression: targetSentence.includesExpression,
        transcriptSegmentId: segmentIdByClientId.get(targetSentence.segmentId) ?? targetSentence.segmentId,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const prompt of input.speakingPrompts ?? []) {
      await this.db.insert(speakingPrompts).values({
        id: this.idGenerator.nextId(),
        contentUnitId: unit.id,
        chineseScenario: prompt.chineseScenario,
        englishPromptGap: prompt.englishPromptGap,
        targetExpression: prompt.targetExpression,
        expectedAnswer: prompt.expectedAnswer,
        createdAt: now,
        updatedAt: now,
      });
    }

    return unit.id;
  }

  async findUnit(unitId: EntityId) {
    const [unit] = await this.db.select().from(contentUnits).where(eq(contentUnits.id, unitId)).limit(1);
    return unit;
  }

  async getUnitDetail(unitId: EntityId) {
    const unit = await this.findUnit(unitId);
    if (!unit) {
      return undefined;
    }

    const [audio] = await this.db.select().from(audioAssets).where(eq(audioAssets.contentUnitId, unitId)).limit(1);
    const segments = await this.db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.contentUnitId, unitId))
      .orderBy(asc(transcriptSegments.segmentOrder));
    const targets = await this.db.select().from(targetSentences).where(eq(targetSentences.contentUnitId, unitId));
    const prompts = await this.db.select().from(speakingPrompts).where(eq(speakingPrompts.contentUnitId, unitId));
    const synced = await this.db.select().from(syncedSegments).where(eq(syncedSegments.contentUnitId, unitId));

    return { unit, audio, segments, targets, prompts, synced };
  }

  async listVisibleUnits(isInternalTester: boolean) {
    const visibleLicenses: LicenseStatus[] = isInternalTester ? ["approved", "internal_review"] : ["approved"];
    return this.db
      .select()
      .from(contentUnits)
      .where(
        and(
          eq(contentUnits.publishStatus, "published"),
          inArray(contentUnits.licenseStatus, visibleLicenses),
          inArray(contentUnits.syncStatus, ["auto_synced", "manually_reviewed"]),
        ),
      )
      .orderBy(asc(contentUnits.publishedAt));
  }

  async publish(unitId: EntityId): Promise<void> {
    const detail = await this.getUnitDetail(unitId);
    if (!detail) {
      throw new AppError("not_found", "Content unit not found");
    }
    if (detail.unit.licenseStatus === "unknown" || detail.unit.licenseStatus === "rejected") {
      throw new AppError("validation_failed", "Unit cannot be published with unknown or rejected license status");
    }
    if (!detail.audio || detail.segments.length === 0 || detail.targets.length === 0 || detail.prompts.length === 0) {
      throw new AppError("validation_failed", "Unit is missing audio, transcript, target sentence, or speaking prompt");
    }

    await this.db
      .update(contentUnits)
      .set({ publishStatus: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(contentUnits.id, unitId));
  }

  async saveSyncedSegments(unitId: EntityId, segments: SyncedSegmentDraft[], manuallyReviewed: boolean): Promise<void> {
    const now = this.idGenerator.now();
    if (segments.length > 0) {
      await this.db.insert(syncedSegments).values(
        segments.map((segment) => ({
          id: this.idGenerator.nextId(),
          contentUnitId: unitId,
          transcriptSegmentId: segment.segmentId,
          startMs: segment.startMs,
          endMs: segment.endMs,
          englishText: segment.englishText,
          chineseText: segment.chineseText ?? null,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    await this.db
      .update(contentUnits)
      .set({ syncStatus: manuallyReviewed ? "manually_reviewed" : "auto_synced", updatedAt: new Date() })
      .where(eq(contentUnits.id, unitId));
  }

  async createImportJob(sourceUrl: string): Promise<EntityId> {
    const now = this.idGenerator.now();
    const [job] = await this.db
      .insert(ingestionJobs)
      .values({ id: this.idGenerator.nextId(), sourceUrl, status: "pending", createdAt: now, updatedAt: now })
      .returning({ id: ingestionJobs.id });
    if (!job) {
      throw new AppError("upstream_failed", "Failed to create import job");
    }
    return job.id;
  }

  async completeImportJob(jobId: EntityId, importedUnitId: EntityId, rawPreview: Record<string, unknown>): Promise<void> {
    await this.db
      .update(ingestionJobs)
      .set({ status: "succeeded", importedContentUnitId: importedUnitId, rawPreview, updatedAt: new Date() })
      .where(eq(ingestionJobs.id, jobId));
  }

  async failImportJob(jobId: EntityId, failureReason: string): Promise<void> {
    await this.db
      .update(ingestionJobs)
      .set({ status: "failed", failureReason, updatedAt: new Date() })
      .where(eq(ingestionJobs.id, jobId));
  }
}
