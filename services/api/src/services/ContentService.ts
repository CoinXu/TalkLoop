import { AppError } from "../domain/AppError.js";
import type { CreateContentUnitInput } from "../domain/ContentModels.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { ContentImportProvider } from "../providers/ContentImportProvider.js";
import type { TranscriptSyncProvider } from "../providers/TranscriptSyncProvider.js";
import type { ContentRepository } from "../repositories/ContentRepository.js";
import type { AssetUrlResolver } from "./AssetUrlResolver.js";
import { importLearningUnit } from "../scripts/importLearningUnit.js";

export class ContentService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly contentImportProvider: ContentImportProvider,
    private readonly transcriptSyncProvider: TranscriptSyncProvider,
    private readonly assetUrlResolver?: AssetUrlResolver,
    private readonly databaseUrl?: string,
  ) {}

  async createDraft(input: CreateContentUnitInput): Promise<{ unitId: string }> {
    if (input.sourceType !== "manual_upload" && !input.sourceUrl) {
      throw new AppError("validation_failed", "sourceUrl is required for imported content");
    }
    const unitId = await this.contentRepository.createDraft(input);
    return { unitId: EntityIdCodec.stringify(unitId) };
  }

  async publish(unitId: EntityId): Promise<void> {
    await this.contentRepository.publish(unitId);
  }

  async importBbcUrl(sourceUrl: string): Promise<{ jobId: string; unitId?: string }> {
    const jobId = await this.contentRepository.createImportJob(sourceUrl);
    try {
      const preview = await this.contentImportProvider.importFromUrl(sourceUrl);
      const unitId = await this.contentRepository.createDraft({
        title: preview.title,
        expression: "TBD",
        expressionMeaning: "待运营确认",
        difficulty: "intermediate",
        sceneTags: [],
        estimatedMinutes: 5,
        sourceType: "bbc_url_import",
        sourceUrl,
        licenseStatus: "internal_review",
        transcriptSegments: [
          {
            englishText: preview.transcriptText,
            chineseText: "待运营补充",
            segmentOrder: 0,
          },
        ],
      });
      await this.contentRepository.completeImportJob(jobId, unitId, { preview });
      return { jobId: EntityIdCodec.stringify(jobId), unitId: EntityIdCodec.stringify(unitId) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown import failure";
      await this.contentRepository.failImportJob(jobId, message);
      throw error;
    }
  }

  async importLearningUnitFromUrls(input: {
    audioUrl: string;
    pdfUrl: string;
    dryRun?: boolean | undefined;
    uploadedBy?: string | undefined;
    audioPublicUrl?: string | undefined;
  }): Promise<{
    unitId?: string;
    dryRun: boolean;
    title: string;
    expression: string;
    expressionMeaning: string;
    transcriptSegmentCount: number;
    audioDurationSeconds: number;
    audioUrl: string;
    localFiles: { audioPath: string; pdfPath: string; manifestPath: string };
  }> {
    const dryRun = input.dryRun ?? false;
    const importOptions = {
      audioUrl: input.audioUrl,
      pdfUrl: input.pdfUrl,
      outputDir: ".data/imports",
      dryRun,
      uploadedBy: input.uploadedBy ?? "api-import",
    };
    const result = await importLearningUnit({
      ...importOptions,
      ...(dryRun || !this.databaseUrl ? {} : { databaseUrl: this.databaseUrl }),
      ...(input.audioPublicUrl ? { audioPublicUrl: input.audioPublicUrl } : {}),
    });

    const response = {
      dryRun,
      title: result.imported.unitDraft.title,
      expression: result.imported.unitDraft.expression,
      expressionMeaning: result.imported.unitDraft.expressionMeaning,
      transcriptSegmentCount: result.imported.unitDraft.transcriptSegments?.length ?? 0,
      audioDurationSeconds: result.imported.audioInfo.durationSeconds,
      audioUrl: result.imported.unitDraft.audioAsset?.url ?? input.audioUrl,
      localFiles: result.imported.localFiles,
    };
    return result.unitId ? { ...response, unitId: result.unitId } : response;
  }

  async autoSync(unitId: EntityId): Promise<void> {
    const detail = await this.contentRepository.getUnitDetail(unitId);
    if (!detail) {
      throw new AppError("not_found", "Content unit not found");
    }
    if (!detail.audio) {
      throw new AppError("validation_failed", "Audio asset is required before sync");
    }
    if (detail.segments.length === 0) {
      throw new AppError("validation_failed", "Transcript segments are required before sync");
    }

    const synced = await this.transcriptSyncProvider.autoSync(
      detail.segments.map((segment) => {
        const transcriptSegment = {
          segmentId: segment.id,
          englishText: segment.englishText,
          segmentOrder: segment.segmentOrder,
        };
        return segment.chineseText === null ? transcriptSegment : { ...transcriptSegment, chineseText: segment.chineseText };
      }),
      { url: this.assetUrlResolver?.toPublicUrl(detail.audio.url) ?? detail.audio.url, durationSeconds: detail.audio.durationSeconds },
    );

    await this.contentRepository.saveSyncedSegments(unitId, synced, false);
  }
}
