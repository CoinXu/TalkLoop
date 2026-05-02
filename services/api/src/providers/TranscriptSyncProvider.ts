import type { TranscriptSegmentInput } from "../domain/ContentModels.js";
import type { EntityId } from "../domain/EntityId.js";

export interface SyncedSegmentDraft {
  segmentId: EntityId;
  startMs: number;
  endMs: number;
  englishText: string;
  chineseText?: string;
}

export interface TranscriptSyncProvider {
  autoSync(
    segments: Array<TranscriptSegmentInput & { segmentId: EntityId }>,
    audio: { url: string; durationSeconds: number },
  ): Promise<SyncedSegmentDraft[]>;
}
