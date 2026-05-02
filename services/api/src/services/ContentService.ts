import { AppError } from "../domain/AppError.js";
import type { CreateContentUnitInput } from "../domain/ContentModels.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { ContentImportProvider } from "../providers/ContentImportProvider.js";
import type { TranscriptSyncProvider } from "../providers/TranscriptSyncProvider.js";
import type { ContentRepository } from "../repositories/ContentRepository.js";

export class ContentService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly contentImportProvider: ContentImportProvider,
    private readonly transcriptSyncProvider: TranscriptSyncProvider,
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
      detail.audio.durationSeconds,
    );

    await this.contentRepository.saveSyncedSegments(unitId, synced, false);
  }
}
