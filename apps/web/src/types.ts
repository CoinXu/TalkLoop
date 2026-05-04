export type JsonRecord = Record<string, unknown>;

export interface ListResponse<T = JsonRecord> {
  items: T[];
}

export type PublishStatus = "draft" | "published" | "archived";
export type ReviewStatus = "pending_review" | "approved" | "rejected";
export type ActivationStatus = "red" | "yellow" | "green";

export interface UserSession {
  sessionId: string;
}

export interface AdminSession {
  adminSessionId: string;
  adminUserId: string;
  loginName: string;
  displayName: string;
  adminRole: string;
  permissionKeys: string[];
  expiresAt?: string;
}

export interface Scene {
  sceneId: string;
  name: string;
  description?: string | null;
  publishStatus: PublishStatus;
  sortOrder?: number;
}

export interface Course {
  courseId: string;
  sceneId?: string | null;
  title: string;
  description?: string | null;
  level?: number;
  publishStatus: PublishStatus;
  sentenceCount?: number;
  unlocked?: boolean;
}

export interface Sentence {
  sentenceId: string;
  courseId?: string | null;
  sceneId?: string | null;
  sentenceText: string;
  translationCn?: string | null;
  targetWords?: string[];
  phraseChunks?: string[];
  difficultyLevel?: number;
  audioStatus?: string;
  normalAudioUrl?: string | null;
  slowAudioUrl?: string | null;
  publishStatus?: PublishStatus;
  reviewStatus?: ReviewStatus;
}

export interface WordEntry {
  wordId: string;
  word: string;
  lemma?: string;
  phonetic?: string | null;
  meaningCn?: string | null;
  meaningEn?: string | null;
  audioUrl?: string | null;
  partOfSpeech?: string | null;
  frequencyCount?: number | null;
  cdCount?: number | null;
  frequencyLow?: number | null;
  cdLow?: number | null;
  subtlwf?: string | number | null;
  lg10wf?: string | number | null;
  subtlcd?: string | number | null;
  lg10cd?: string | number | null;
  difficultyLevel?: number | null;
  publishStatus?: PublishStatus;
  reviewStatus?: ReviewStatus;
  audioStatus?: string;
  sceneTags?: string[];
  levelTags?: string[];
  hearingTrap?: string | null;
  distractors?: {
    pronunciation?: string[];
    meaning?: string[];
    difficulty?: string[];
  };
  commonCollocations?: string[];
  isExcluded?: boolean;
  exclusionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubtlexusWord {
  subtlexusWordId: string;
  importBatchId: string;
  sourceFileName: string;
  word: string;
  normalizedWord: string;
  freqCount: number | null;
  cdCount: number | null;
  freqLow: number | null;
  cdLow: number | null;
  subtlWf: string | null;
  lg10Wf: string | null;
  subtlCd: string | null;
  lg10Cd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WordMeta {
  createdAt: string;
  derivedFields: JsonRecord;
  importBatchId: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
  meanings: JsonRecord[];
  normalizedWord: string;
  phonetics: JsonRecord[];
  rawPayload: JsonRecord | JsonRecord[];
  source: string;
  sourceUrl: string | null;
  updatedAt: string;
  word: string;
  wordId: string | null;
  wordMetaId: string;
}

export interface SubtlexusImportResult {
  created: number;
  dryRun: boolean;
  fileName: string;
  importBatchId: string;
  importableRows: number;
  skippedRows: number;
  total?: number;
  totalRows: number;
  updated: number;
}

export interface CreateWordsFromSubtlexusResult {
  created: number;
  skippedExisting: number;
  source: "subtlexus";
}

export interface VocabularyOverview {
  total: number;
  red: number;
  yellow: number;
  green: number;
  activationRate: number;
}

export interface DailyTask {
  dailyTaskId?: string;
  taskDate?: string;
  status?: string;
  strategyVersion?: string;
  summary?: JsonRecord;
  items?: Array<JsonRecord & { itemType?: string; status?: string }>;
}
