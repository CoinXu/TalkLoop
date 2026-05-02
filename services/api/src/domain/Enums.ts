export const sourceTypes = ["manual_upload", "bbc_url_import", "other_url_import"] as const;
export type SourceType = (typeof sourceTypes)[number];

export const licenseStatuses = ["unknown", "internal_review", "approved", "restricted", "rejected"] as const;
export type LicenseStatus = (typeof licenseStatuses)[number];

export const publishStatuses = ["draft", "published", "archived"] as const;
export type PublishStatus = (typeof publishStatuses)[number];

export const syncStatuses = ["not_synced", "auto_synced", "manually_reviewed"] as const;
export type SyncStatus = (typeof syncStatuses)[number];

export const progressStatuses = ["not_started", "in_progress", "completed"] as const;
export type ProgressStatus = (typeof progressStatuses)[number];

export const learningSteps = [
  "listen_original",
  "intensive_listening",
  "target_shadowing",
  "speaking_prompt",
  "score_result",
] as const;
export type LearningStep = (typeof learningSteps)[number];

export const scoreTargetTypes = ["target_sentence", "speaking_prompt"] as const;
export type ScoreTargetType = (typeof scoreTargetTypes)[number];

export const importJobStatuses = ["pending", "succeeded", "failed"] as const;
export type ImportJobStatus = (typeof importJobStatuses)[number];
