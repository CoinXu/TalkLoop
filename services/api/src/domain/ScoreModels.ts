import type { ScoreTargetType } from "./Enums.js";
import type { EntityId } from "./EntityId.js";

export interface SubmitScoreInput {
  userId: EntityId;
  unitId: EntityId;
  scoreTargetType: ScoreTargetType;
  targetId: EntityId;
  targetText: string;
  recordingBuffer: Buffer;
  recordingMimeType: string;
}

export interface SpeakingScoreResult {
  overallScore: number;
  pronunciationScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
}

export interface ScoreRecordView extends SpeakingScoreResult {
  scoreId: string;
  unitId: EntityId;
  scoreTargetType: ScoreTargetType;
  targetId: string;
  recordingUrl: string;
  createdAt: Date;
}
