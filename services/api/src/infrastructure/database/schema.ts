import {
  bigint as pgBigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  importJobStatuses,
  learningSteps,
  licenseStatuses,
  progressStatuses,
  publishStatuses,
  scoreTargetTypes,
  sourceTypes,
  syncStatuses,
} from "../../domain/Enums.js";

export const sourceTypeEnum = pgEnum("source_type", sourceTypes);
export const licenseStatusEnum = pgEnum("license_status", licenseStatuses);
export const publishStatusEnum = pgEnum("publish_status", publishStatuses);
export const syncStatusEnum = pgEnum("sync_status", syncStatuses);
export const progressStatusEnum = pgEnum("progress_status", progressStatuses);
export const learningStepEnum = pgEnum("learning_step", learningSteps);
export const scoreTargetTypeEnum = pgEnum("score_target_type", scoreTargetTypes);
export const importJobStatusEnum = pgEnum("import_job_status", importJobStatuses);

function baseColumns() {
  return {
    id: pgBigint("id", { mode: "bigint" }).primaryKey(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  };
}

export const users = pgTable(
  "users",
  {
    ...baseColumns(),
    loginDestination: text("login_destination").notNull(),
    isInternalTester: boolean("is_internal_tester").notNull().default(false),
  },
  (table) => ({
    loginDestinationIdx: uniqueIndex("users_login_destination_idx").on(table.loginDestination),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    ...baseColumns(),
    userId: pgBigint("user_id", { mode: "bigint" }).notNull().references(() => users.id),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    userIdx: index("sessions_user_idx").on(table.userId),
  }),
);

export const contentUnits = pgTable(
  "content_units",
  {
    ...baseColumns(),
    title: text("title").notNull(),
    expression: text("expression").notNull(),
    expressionMeaning: text("expression_meaning").notNull(),
    difficulty: text("difficulty").notNull(),
    sceneTags: jsonb("scene_tags").$type<string[]>().notNull().default([]),
    estimatedMinutes: integer("estimated_minutes").notNull().default(5),
    sourceType: sourceTypeEnum("source_type").notNull(),
    sourceUrl: text("source_url"),
    licenseStatus: licenseStatusEnum("license_status").notNull().default("unknown"),
    publishStatus: publishStatusEnum("publish_status").notNull().default("draft"),
    syncStatus: syncStatusEnum("sync_status").notNull().default("not_synced"),
    publishedAt: timestamp("published_at"),
  },
  (table) => ({
    sourceUrlIdx: uniqueIndex("content_units_source_url_idx").on(table.sourceUrl),
    listIdx: index("content_units_list_idx").on(table.publishStatus, table.licenseStatus, table.syncStatus),
  }),
);

export const audioAssets = pgTable(
  "audio_assets",
  {
    ...baseColumns(),
    contentUnitId: pgBigint("content_unit_id", { mode: "bigint" }).notNull().references(() => contentUnits.id),
    url: text("url").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    format: text("format").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
  },
  (table) => ({
    unitIdx: index("audio_assets_content_unit_idx").on(table.contentUnitId),
  }),
);

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    ...baseColumns(),
    contentUnitId: pgBigint("content_unit_id", { mode: "bigint" }).notNull().references(() => contentUnits.id),
    englishText: text("english_text").notNull(),
    chineseText: text("chinese_text"),
    speaker: text("speaker"),
    segmentOrder: integer("segment_order").notNull(),
  },
  (table) => ({
    unitOrderIdx: uniqueIndex("transcript_segments_unit_order_idx").on(table.contentUnitId, table.segmentOrder),
  }),
);

export const targetSentences = pgTable(
  "target_sentences",
  {
    ...baseColumns(),
    contentUnitId: pgBigint("content_unit_id", { mode: "bigint" }).notNull().references(() => contentUnits.id),
    englishText: text("english_text").notNull(),
    chinesePrompt: text("chinese_prompt").notNull(),
    includesExpression: boolean("includes_expression").notNull(),
    transcriptSegmentId: pgBigint("transcript_segment_id", { mode: "bigint" }).notNull().references(() => transcriptSegments.id),
  },
  (table) => ({
    unitIdx: index("target_sentences_content_unit_idx").on(table.contentUnitId),
  }),
);

export const speakingPrompts = pgTable(
  "speaking_prompts",
  {
    ...baseColumns(),
    contentUnitId: pgBigint("content_unit_id", { mode: "bigint" }).notNull().references(() => contentUnits.id),
    chineseScenario: text("chinese_scenario").notNull(),
    englishPromptGap: text("english_prompt_gap").notNull(),
    targetExpression: text("target_expression").notNull(),
    expectedAnswer: text("expected_answer").notNull(),
  },
  (table) => ({
    unitIdx: index("speaking_prompts_content_unit_idx").on(table.contentUnitId),
  }),
);

export const syncedSegments = pgTable(
  "synced_segments",
  {
    ...baseColumns(),
    contentUnitId: pgBigint("content_unit_id", { mode: "bigint" }).notNull().references(() => contentUnits.id),
    transcriptSegmentId: pgBigint("transcript_segment_id", { mode: "bigint" }).notNull().references(() => transcriptSegments.id),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    englishText: text("english_text").notNull(),
    chineseText: text("chinese_text"),
  },
  (table) => ({
    unitIdx: index("synced_segments_content_unit_idx").on(table.contentUnitId),
  }),
);

export const unitProgress = pgTable(
  "unit_progress",
  {
    ...baseColumns(),
    userId: pgBigint("user_id", { mode: "bigint" }).notNull().references(() => users.id),
    contentUnitId: pgBigint("content_unit_id", { mode: "bigint" }).notNull().references(() => contentUnits.id),
    currentStep: learningStepEnum("current_step").notNull().default("listen_original"),
    status: progressStatusEnum("status").notNull().default("not_started"),
  },
  (table) => ({
    userUnitIdx: uniqueIndex("unit_progress_user_unit_idx").on(table.userId, table.contentUnitId),
  }),
);

export const scoreRecords = pgTable(
  "score_records",
  {
    ...baseColumns(),
    userId: pgBigint("user_id", { mode: "bigint" }).notNull().references(() => users.id),
    contentUnitId: pgBigint("content_unit_id", { mode: "bigint" }).notNull().references(() => contentUnits.id),
    scoreTargetType: scoreTargetTypeEnum("score_target_type").notNull(),
    targetId: pgBigint("target_id", { mode: "bigint" }).notNull(),
    targetText: text("target_text").notNull(),
    overallScore: integer("overall_score").notNull(),
    pronunciationScore: integer("pronunciation_score"),
    fluencyScore: integer("fluency_score"),
    completenessScore: integer("completeness_score"),
    recordingUrl: text("recording_url").notNull(),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>(),
  },
  (table) => ({
    userUnitCreatedIdx: index("score_records_user_unit_created_idx").on(table.userId, table.contentUnitId, table.createdAt),
    targetIdx: index("score_records_target_idx").on(table.userId, table.scoreTargetType, table.targetId),
  }),
);

export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    ...baseColumns(),
    sourceUrl: text("source_url").notNull(),
    status: importJobStatusEnum("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    importedContentUnitId: pgBigint("imported_content_unit_id", { mode: "bigint" }).references(() => contentUnits.id),
    rawPreview: jsonb("raw_preview").$type<Record<string, unknown>>(),
  },
  (table) => ({
    sourceUrlIdx: index("ingestion_jobs_source_url_idx").on(table.sourceUrl),
  }),
);
