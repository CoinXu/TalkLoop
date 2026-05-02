import type { LicenseStatus, PublishStatus, SourceType, SyncStatus } from "./Enums.js";
import type { EntityId } from "./EntityId.js";

export interface AudioAssetInput {
  url: string;
  durationSeconds: number;
  format: string;
  uploadedBy: string;
}

export interface TranscriptSegmentInput {
  segmentId?: EntityId | undefined;
  englishText: string;
  chineseText?: string | undefined;
  speaker?: string | undefined;
  segmentOrder: number;
}

export interface TargetSentenceInput {
  targetSentenceId?: EntityId | undefined;
  englishText: string;
  chinesePrompt: string;
  includesExpression: boolean;
  segmentId: EntityId;
}

export interface SpeakingPromptInput {
  speakingPromptId?: EntityId | undefined;
  chineseScenario: string;
  englishPromptGap: string;
  targetExpression: string;
  expectedAnswer: string;
}

export interface CreateContentUnitInput {
  title: string;
  expression: string;
  expressionMeaning: string;
  difficulty: string;
  sceneTags: string[];
  estimatedMinutes: number;
  sourceType: SourceType;
  sourceUrl?: string | undefined;
  licenseStatus?: LicenseStatus | undefined;
  audioAsset?: AudioAssetInput | undefined;
  transcriptSegments?: TranscriptSegmentInput[] | undefined;
  targetSentences?: TargetSentenceInput[] | undefined;
  speakingPrompts?: SpeakingPromptInput[] | undefined;
}

export interface ContentUnitCard {
  unitId: string;
  title: string;
  expression: string;
  expressionMeaning: string;
  difficulty: string;
  estimatedMinutes: number;
  licenseStatus: LicenseStatus;
  publishStatus: PublishStatus;
  syncStatus: SyncStatus;
  isInternalOnly: boolean;
}
