import type { SyncedSegmentDraft, TranscriptSyncProvider } from "./TranscriptSyncProvider.js";
import type { TranscriptSegmentInput } from "../domain/ContentModels.js";
import type { EntityId } from "../domain/EntityId.js";

export class BasicTranscriptSyncProvider implements TranscriptSyncProvider {
  async autoSync(
    segments: Array<TranscriptSegmentInput & { segmentId: EntityId }>,
    audioDurationSeconds: number,
  ): Promise<SyncedSegmentDraft[]> {
    if (segments.length === 0) {
      return [];
    }

    const sliceMs = Math.max(1000, Math.floor((audioDurationSeconds * 1000) / segments.length));
    return segments.map((segment, index) => {
      const syncedSegment: SyncedSegmentDraft = {
        segmentId: segment.segmentId,
        startMs: index * sliceMs,
        endMs: index === segments.length - 1 ? audioDurationSeconds * 1000 : (index + 1) * sliceMs,
        englishText: segment.englishText,
      };
      if (segment.chineseText !== undefined) {
        syncedSegment.chineseText = segment.chineseText;
      }
      return syncedSegment;
    });
  }
}
