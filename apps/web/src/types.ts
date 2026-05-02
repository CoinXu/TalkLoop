export type ProgressStatus = "not_started" | "in_progress" | "completed";

export type LearningStep =
  | "listen_original"
  | "intensive_listening"
  | "target_shadowing"
  | "speaking_prompt"
  | "score_result";

export type ScoreTargetType = "target_sentence" | "speaking_prompt";

export interface Session {
  sessionId: string;
  userId: string;
  isInternalTester: boolean;
  expiresAt: string;
}

export interface HomeUnitCard {
  unitId: string;
  title: string;
  expression: string;
  expressionMeaning: string;
  estimatedMinutes: number;
  difficulty: string;
  completionStatus: ProgressStatus | string;
  recentScore?: number;
  isInternalOnly: boolean;
}

export interface ContinueLearning {
  unitId?: string;
  contentUnitId?: string;
  title?: string;
  expression?: string;
  currentStep?: LearningStep;
  status?: ProgressStatus;
  updatedAt?: string;
}

export interface HomeResponse {
  continueLearning?: ContinueLearning | null;
  units: HomeUnitCard[];
}

export interface AudioAsset {
  id?: string;
  audioId?: string;
  contentUnitId?: string;
  url?: string;
  durationSeconds?: number;
  format?: string;
  uploadedBy?: string;
}

export interface TranscriptSegment {
  id?: string;
  segmentId?: string;
  contentUnitId?: string;
  englishText: string;
  chineseText?: string | null;
  speaker?: string;
  segmentOrder?: number;
}

export interface SyncedSegment extends TranscriptSegment {
  transcriptSegmentId?: string;
  startMs?: number;
  endMs?: number;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
}

export interface TargetSentence {
  id?: string;
  targetSentenceId?: string;
  contentUnitId?: string;
  englishText: string;
  chinesePrompt: string;
  includesExpression: boolean;
  transcriptSegmentId?: string;
  segmentId?: string;
}

export interface SpeakingPrompt {
  id?: string;
  speakingPromptId?: string;
  contentUnitId?: string;
  chineseScenario: string;
  englishPromptGap: string;
  targetExpression: string;
  expectedAnswer: string;
}

export type SourceType = "manual_upload" | "bbc_url_import" | "other_url_import" | "bbc_import";

export type LicenseStatus = "unknown" | "internal_review" | "approved" | "restricted" | "rejected";

export interface UnitSummary {
  unitId: string;
  title: string;
  expression: string;
  expressionMeaning: string;
  difficulty?: string;
  sceneTags?: string[];
  estimatedMinutes?: number;
}

export interface CreateTranscriptSegmentInput {
  segmentId: string;
  englishText: string;
  chineseText?: string;
  speaker?: string;
  segmentOrder: number;
}

export interface CreateTargetSentenceInput {
  englishText: string;
  chinesePrompt: string;
  includesExpression: boolean;
  segmentId: string;
}

export interface CreateSpeakingPromptInput {
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
  sourceUrl?: string;
  licenseStatus: LicenseStatus;
  audioAsset: Omit<AudioAsset, "audioId">;
  transcriptSegments: CreateTranscriptSegmentInput[];
  targetSentences: CreateTargetSentenceInput[];
  speakingPrompts: CreateSpeakingPromptInput[];
}

export interface AdminContentUnitResponse {
  unitId?: string;
  unit?: Partial<UnitSummary> & Record<string, unknown>;
  publishStatus?: string;
}

export interface ImportBbcResponse {
  jobId: string;
  unitId?: string;
}

export interface ImportLearningUnitInput {
  audioUrl: string;
  pdfUrl: string;
  dryRun?: boolean;
  uploadedBy?: string;
  audioPublicUrl?: string;
}

export interface ImportLearningUnitResponse {
  unitId?: string;
  dryRun: boolean;
  title: string;
  expression: string;
  expressionMeaning: string;
  transcriptSegmentCount: number;
  audioDurationSeconds: number;
  audioUrl: string;
  localFiles: {
    audioPath: string;
    pdfPath: string;
    manifestPath: string;
  };
}

export interface UnitProgress {
  currentStep?: LearningStep;
  status?: ProgressStatus;
  updatedAt?: string;
}

export interface LearningUnitResponse {
  unit: Partial<UnitSummary> & Record<string, unknown>;
  audio?: AudioAsset | null;
  segments: TranscriptSegment[];
  targets: TargetSentence[];
  prompts: SpeakingPrompt[];
  synced: SyncedSegment[];
  progress?: UnitProgress | null;
}

export interface SubmitScoreInput {
  unitId: string;
  scoreTargetType: ScoreTargetType;
  targetId: string;
  targetText: string;
  recordingBase64: string;
  recordingMimeType: string;
}

export interface ScoreRecord {
  id: string;
  userId: string;
  contentUnitId: string;
  scoreTargetType: ScoreTargetType;
  targetId: string;
  targetText: string;
  overallScore: number;
  pronunciationScore?: number | null;
  fluencyScore?: number | null;
  completenessScore?: number | null;
  recordingUrl: string;
  createdAt: string;
  updatedAt: string;
}
