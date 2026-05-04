export type ContentStatus = "draft" | "published" | "unpublished" | "archived";

export type AudioStatus = "real" | "default" | "missing" | "unreachable";

export type ValidationSeverity = "blocking" | "warning";

export interface ContentScene {
  sceneId: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  status: ContentStatus;
  courseCount: number;
  publishedCourseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentCourse {
  courseId: string;
  sceneId: string;
  title: string;
  slug: string;
  level: string;
  description: string;
  sortOrder: number;
  minSentenceCount: number;
  maxSentenceCount: number;
  unlockRule: string;
  status: ContentStatus;
  validationStatus: "pass" | "warning" | "fail";
  needsRevalidation: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSentence {
  sentenceId: string;
  text: string;
  difficulty: string;
  targetWord: string;
  phraseChunks: string[];
  sceneTag: string;
  sceneId: string | null;
  courseId: string | null;
  sortOrder: number | null;
  audioStatus: AudioStatus;
  normalAudioUrl: string | null;
  slowAudioUrl: string | null;
  status: ContentStatus;
  referenceCount: number;
  importBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  auditId: string;
  actor: string;
  actionType: "create" | "update" | "status_change" | "composition_change" | "bulk_assign" | "import";
  objectId: string;
  objectType: "scene" | "course" | "sentence" | "import";
  summary: string;
  createdAt: string;
}

export interface ValidationIssue {
  id: string;
  objectType: "scene" | "course" | "sentence";
  objectId: string;
  objectName: string;
  severity: ValidationSeverity;
  message: string;
  fixTarget: "scene" | "course" | "sentence" | "composition" | "audio";
}

export interface BulkResult {
  failed: number;
  reasons: Array<{ id: string; reason: string }>;
  skipped: number;
  succeeded: number;
}

export interface ImportPreviewRow {
  rowId: string;
  sentenceText: string;
  targetWord: string;
  sceneTag: string;
  difficulty: string;
  severity: "ok" | "warning" | "error";
  message: string;
}

export interface ContentAdminState {
  auditLog: AuditEntry[];
  defaultAudioConfigured: boolean;
  importRows: ImportPreviewRow[];
  scenes: ContentScene[];
  courses: ContentCourse[];
  sentences: ContentSentence[];
}
