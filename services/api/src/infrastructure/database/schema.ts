import {
  bigint as pgBigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

function baseColumns() {
  return {
    id: pgBigint("id", { mode: "bigint" }).primaryKey(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  };
}

export const adminUsers = pgTable(
  "admin_users",
  {
    ...baseColumns(),
    loginName: text("login_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("enabled"),
    createdByAdminId: pgBigint("created_by_admin_id", { mode: "bigint" }),
    updatedByAdminId: pgBigint("updated_by_admin_id", { mode: "bigint" }),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => ({
    loginNameIdx: uniqueIndex("admin_users_login_name_idx").on(table.loginName),
    statusRoleIdx: index("admin_users_status_role_idx").on(table.status, table.role),
  }),
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    ...baseColumns(),
    adminUserId: pgBigint("admin_user_id", { mode: "bigint" }).notNull().references(() => adminUsers.id),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    sessionUserIdx: index("admin_sessions_user_idx").on(table.adminUserId),
    sessionStatusIdx: index("admin_sessions_status_idx").on(table.status, table.expiresAt),
  }),
);

export const adminPermissions = pgTable(
  "admin_permissions",
  {
    permissionKey: text("permission_key").primaryKey(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
);

export const adminRolePermissions = pgTable(
  "admin_role_permissions",
  {
    id: pgBigint("id", { mode: "bigint" }).primaryKey(),
    adminRole: text("admin_role").notNull(),
    permissionKey: text("permission_key").notNull().references(() => adminPermissions.permissionKey),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    rolePermissionIdx: uniqueIndex("admin_role_permissions_role_key_idx").on(table.adminRole, table.permissionKey),
  }),
);

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: pgBigint("id", { mode: "bigint" }).primaryKey(),
    adminUserId: pgBigint("admin_user_id", { mode: "bigint" }).references(() => adminUsers.id),
    adminRole: text("admin_role").notNull(),
    permissionKey: text("permission_key").notNull(),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id"),
    oldValue: jsonb("old_value").$type<Record<string, unknown> | null>(),
    newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    objectIdx: index("admin_audit_logs_object_idx").on(table.objectType, table.objectId),
    adminCreatedIdx: index("admin_audit_logs_admin_created_idx").on(table.adminUserId, table.createdAt),
  }),
);

export const wordEntries = pgTable(
  "word_entries",
  {
    ...baseColumns(),
    word: text("word").notNull(),
    lemma: text("lemma").notNull(),
    phonetic: text("phonetic"),
    meaningCn: text("meaning_cn"),
    meaningEn: text("meaning_en"),
    audioUrl: text("audio_url"),
    partOfSpeech: text("part_of_speech"),
    frequencyCount: integer("frequency_count"),
    cdCount: integer("cd_count"),
    frequencyLow: integer("frequency_low"),
    cdLow: integer("cd_low"),
    subtlwf: numeric("subtlwf"),
    lg10wf: numeric("lg10wf"),
    subtlcd: numeric("subtlcd"),
    lg10cd: numeric("lg10cd"),
    difficultyLevel: integer("difficulty_level"),
    levelTags: jsonb("level_tags").$type<string[]>().notNull().default([]),
    sceneTags: jsonb("scene_tags").$type<string[]>().notNull().default([]),
    hearingTrap: text("hearing_trap"),
    distractors: jsonb("distractors").$type<{ pronunciation: string[]; meaning: string[]; difficulty: string[] }>().notNull().default({ pronunciation: [], meaning: [], difficulty: [] }),
    commonCollocations: jsonb("common_collocations").$type<string[]>().notNull().default([]),
    reviewStatus: text("review_status").notNull().default("pending_review"),
    publishStatus: text("publish_status").notNull().default("draft"),
    audioStatus: text("audio_status").notNull().default("missing"),
    isExcluded: boolean("is_excluded").notNull().default(false),
    exclusionReason: text("exclusion_reason"),
  },
  (table) => ({
    wordIdx: uniqueIndex("word_entries_word_idx").on(table.word),
    listIdx: index("word_entries_list_idx").on(table.publishStatus, table.reviewStatus, table.difficultyLevel),
    lemmaIdx: index("word_entries_lemma_idx").on(table.lemma),
  }),
);

export const subtlexusWords = pgTable(
  "subtlexus_words",
  {
    ...baseColumns(),
    word: text("word").notNull(),
    normalizedWord: text("normalized_word").notNull(),
    freqCount: integer("freq_count"),
    cdCount: integer("cd_count"),
    freqLow: integer("freq_low"),
    cdLow: integer("cd_low"),
    subtlWf: numeric("subtl_wf"),
    lg10Wf: numeric("lg10_wf"),
    subtlCd: numeric("subtl_cd"),
    lg10Cd: numeric("lg10_cd"),
    sourceFileName: text("source_file_name").notNull(),
    importBatchId: text("import_batch_id").notNull(),
  },
  (table) => ({
    wordIdx: uniqueIndex("subtlexus_words_word_idx").on(table.word),
    normalizedWordIdx: index("subtlexus_words_normalized_word_idx").on(table.normalizedWord),
    frequencyIdx: index("subtlexus_words_frequency_idx").on(table.lg10Wf, table.freqCount),
    importBatchIdx: index("subtlexus_words_import_batch_idx").on(table.importBatchId),
  }),
);

export const corpusScenes = pgTable(
  "corpus_scenes",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    publishStatus: text("publish_status").notNull().default("draft"),
  },
  (table) => ({
    nameIdx: uniqueIndex("corpus_scenes_name_idx").on(table.name),
    publishIdx: index("corpus_scenes_publish_idx").on(table.publishStatus, table.sortOrder),
  }),
);

export const courses = pgTable(
  "courses",
  {
    ...baseColumns(),
    sceneId: pgBigint("scene_id", { mode: "bigint" }).notNull().references(() => corpusScenes.id),
    title: text("title").notNull(),
    description: text("description"),
    level: integer("level").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    unlockPolicy: jsonb("unlock_policy").$type<Record<string, unknown>>().notNull().default({ type: "previous_course_completed" }),
    publishStatus: text("publish_status").notNull().default("draft"),
  },
  (table) => ({
    sceneIdx: index("courses_scene_idx").on(table.sceneId, table.sortOrder),
    publishIdx: index("courses_publish_idx").on(table.publishStatus, table.level),
  }),
);

export const corpusSentences = pgTable(
  "corpus_sentences",
  {
    ...baseColumns(),
    courseId: pgBigint("course_id", { mode: "bigint" }).references(() => courses.id),
    sceneId: pgBigint("scene_id", { mode: "bigint" }).references(() => corpusScenes.id),
    sentenceText: text("sentence_text").notNull(),
    translationCn: text("translation_cn"),
    normalAudioUrl: text("normal_audio_url"),
    slowAudioUrl: text("slow_audio_url"),
    audioStatus: text("audio_status").notNull().default("missing"),
    targetWords: jsonb("target_words").$type<string[]>().notNull().default([]),
    bonusWords: jsonb("bonus_words").$type<string[]>().notNull().default([]),
    phraseChunks: jsonb("phrase_chunks").$type<string[]>().notNull().default([]),
    difficultyLevel: integer("difficulty_level").notNull(),
    sceneTags: jsonb("scene_tags").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    reviewStatus: text("review_status").notNull().default("pending_review"),
    publishStatus: text("publish_status").notNull().default("draft"),
  },
  (table) => ({
    courseIdx: index("corpus_sentences_course_idx").on(table.courseId, table.sortOrder),
    publishIdx: index("corpus_sentences_publish_idx").on(table.publishStatus, table.reviewStatus, table.difficultyLevel),
  }),
);

export const annotationTasks = pgTable(
  "annotation_tasks",
  {
    ...baseColumns(),
    targetType: text("target_type").notNull(),
    targetId: pgBigint("target_id", { mode: "bigint" }).notNull(),
    taskType: text("task_type").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull().default({}),
    confidence: numeric("confidence"),
    reviewStatus: text("review_status").notNull().default("pending_review"),
    reviewerAdminId: pgBigint("reviewer_admin_id", { mode: "bigint" }).references(() => adminUsers.id),
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),
  },
  (table) => ({
    targetIdx: index("annotation_tasks_target_idx").on(table.targetType, table.targetId),
    reviewIdx: index("annotation_tasks_review_idx").on(table.reviewStatus, table.taskType),
  }),
);

export const assessmentConfigs = pgTable(
  "assessment_configs",
  {
    ...baseColumns(),
    version: text("version").notNull(),
    status: text("status").notNull().default("draft"),
    selfDescriptionQuestions: jsonb("self_description_questions").$type<Record<string, unknown>[]>().notNull().default([]),
    estimateMatrix: jsonb("estimate_matrix").$type<Record<string, unknown>>().notNull().default({}),
    samplingStrategy: jsonb("sampling_strategy").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    versionIdx: uniqueIndex("assessment_configs_version_idx").on(table.version),
    statusIdx: index("assessment_configs_status_idx").on(table.status),
  }),
);

export const userAssessmentResults = pgTable(
  "user_assessment_results",
  {
    ...baseColumns(),
    userId: text("user_id").notNull(),
    configId: pgBigint("config_id", { mode: "bigint" }).references(() => assessmentConfigs.id),
    source: text("source").notNull(),
    painPoints: jsonb("pain_points").$type<string[]>().notNull().default([]),
    vocabularyEstimate: integer("vocabulary_estimate").notNull(),
    frequencyBoundary: jsonb("frequency_boundary").$type<Record<string, unknown>>().notNull().default({}),
    verificationRounds: jsonb("verification_rounds").$type<Record<string, unknown>[]>().notNull().default([]),
    status: text("status").notNull().default("completed"),
  },
  (table) => ({
    userIdx: index("user_assessment_results_user_idx").on(table.userId, table.createdAt),
  }),
);

export const userVocabularyEntries = pgTable(
  "user_vocabulary_entries",
  {
    ...baseColumns(),
    userId: text("user_id").notNull(),
    wordId: pgBigint("word_id", { mode: "bigint" }).notNull().references(() => wordEntries.id),
    activationStatus: text("activation_status").notNull().default("red"),
    consecutiveCorrect: integer("consecutive_correct").notNull().default(0),
    totalAttempts: integer("total_attempts").notNull().default(0),
    totalCorrect: integer("total_correct").notNull().default(0),
    lastPracticeType: text("last_practice_type"),
    nextReviewAt: timestamp("next_review_at"),
    srsIntervalDays: integer("srs_interval_days").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
    sentenceExposures: integer("sentence_exposures").notNull().default(0),
    spokenCount: integer("spoken_count").notNull().default(0),
    weakPronunciations: jsonb("weak_pronunciations").$type<string[]>().notNull().default([]),
    skipCount: integer("skip_count").notNull().default(0),
    avoidUntil: timestamp("avoid_until"),
    source: text("source").notNull().default("assessment"),
  },
  (table) => ({
    userWordIdx: uniqueIndex("user_vocabulary_entries_user_word_idx").on(table.userId, table.wordId),
    statusIdx: index("user_vocabulary_entries_status_idx").on(table.userId, table.activationStatus, table.nextReviewAt),
  }),
);

export const userVocabularyEvents = pgTable(
  "user_vocabulary_events",
  {
    id: pgBigint("id", { mode: "bigint" }).primaryKey(),
    userVocabularyEntryId: pgBigint("user_vocabulary_entry_id", { mode: "bigint" }).notNull().references(() => userVocabularyEntries.id),
    userId: text("user_id").notNull(),
    oldStatus: text("old_status"),
    newStatus: text("new_status"),
    eventType: text("event_type").notNull(),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    adminUserId: pgBigint("admin_user_id", { mode: "bigint" }).references(() => adminUsers.id),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    entryIdx: index("user_vocabulary_events_entry_idx").on(table.userVocabularyEntryId, table.createdAt),
  }),
);

export const practiceRuleConfigs = pgTable(
  "practice_rule_configs",
  {
    ...baseColumns(),
    version: text("version").notNull(),
    status: text("status").notNull().default("draft"),
    rules: jsonb("rules").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    versionIdx: uniqueIndex("practice_rule_configs_version_idx").on(table.version),
    statusIdx: index("practice_rule_configs_status_idx").on(table.status),
  }),
);

export const wordActivationAttempts = pgTable(
  "word_activation_attempts",
  {
    id: pgBigint("id", { mode: "bigint" }).primaryKey(),
    userId: text("user_id").notNull(),
    wordId: pgBigint("word_id", { mode: "bigint" }).references(() => wordEntries.id),
    sentenceId: pgBigint("sentence_id", { mode: "bigint" }).references(() => corpusSentences.id),
    practiceType: text("practice_type").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    selectedAnswer: text("selected_answer"),
    correctAnswer: text("correct_answer"),
    replayCount: integer("replay_count").notNull().default(0),
    ruleVersion: text("rule_version").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    userIdx: index("word_activation_attempts_user_idx").on(table.userId, table.createdAt),
    wordIdx: index("word_activation_attempts_word_idx").on(table.wordId, table.practiceType),
  }),
);

export const dailyTaskStrategies = pgTable(
  "daily_task_strategies",
  {
    ...baseColumns(),
    version: text("version").notNull(),
    status: text("status").notNull().default("draft"),
    rules: jsonb("rules").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    versionIdx: uniqueIndex("daily_task_strategies_version_idx").on(table.version),
    statusIdx: index("daily_task_strategies_status_idx").on(table.status),
  }),
);

export const dailyTasks = pgTable(
  "daily_tasks",
  {
    ...baseColumns(),
    userId: text("user_id").notNull(),
    taskDate: text("task_date").notNull(),
    strategyVersion: text("strategy_version").notNull(),
    status: text("status").notNull().default("generated"),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
    generationLog: jsonb("generation_log").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => ({
    userDateIdx: uniqueIndex("daily_tasks_user_date_idx").on(table.userId, table.taskDate),
    statusIdx: index("daily_tasks_status_idx").on(table.status, table.taskDate),
  }),
);

export const dailyTaskItems = pgTable(
  "daily_task_items",
  {
    ...baseColumns(),
    dailyTaskId: pgBigint("daily_task_id", { mode: "bigint" }).notNull().references(() => dailyTasks.id),
    itemType: text("item_type").notNull(),
    wordId: pgBigint("word_id", { mode: "bigint" }).references(() => wordEntries.id),
    sentenceId: pgBigint("sentence_id", { mode: "bigint" }).references(() => corpusSentences.id),
    priorityScore: numeric("priority_score").notNull().default("0"),
    status: text("status").notNull().default("pending"),
  },
  (table) => ({
    taskIdx: index("daily_task_items_task_idx").on(table.dailyTaskId, table.status),
  }),
);

export const listenRepeatAttempts = pgTable(
  "listen_repeat_attempts",
  {
    id: pgBigint("id", { mode: "bigint" }).primaryKey(),
    userId: text("user_id").notNull(),
    sentenceId: pgBigint("sentence_id", { mode: "bigint" }).notNull().references(() => corpusSentences.id),
    mode: text("mode").notNull(),
    phraseChunkIndex: integer("phrase_chunk_index"),
    originalAudioDurationMs: integer("original_audio_duration_ms"),
    recordingDurationMs: integer("recording_duration_ms"),
    recordingUrl: text("recording_url"),
    transcript: text("transcript"),
    textMatchRate: numeric("text_match_rate"),
    textMatchLevel: text("text_match_level"),
    speedRatio: numeric("speed_ratio"),
    targetWordHits: jsonb("target_word_hits").$type<string[]>().notNull().default([]),
    waveformSummary: jsonb("waveform_summary").$type<Record<string, unknown>>().notNull().default({}),
    asrStatus: text("asr_status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    userIdx: index("listen_repeat_attempts_user_idx").on(table.userId, table.createdAt),
    sentenceIdx: index("listen_repeat_attempts_sentence_idx").on(table.sentenceId, table.textMatchRate),
  }),
);

export const sentenceLearningStats = pgTable(
  "sentence_learning_stats",
  {
    ...baseColumns(),
    userId: text("user_id").notNull(),
    sentenceId: pgBigint("sentence_id", { mode: "bigint" }).notNull().references(() => corpusSentences.id),
    attempts: integer("attempts").notNull().default(0),
    bestAccuracy: numeric("best_accuracy"),
    latestAccuracy: numeric("latest_accuracy"),
    latestMode: text("latest_mode"),
    latestSpeedRatio: numeric("latest_speed_ratio"),
    firstPracticedAt: timestamp("first_practiced_at"),
    lastPracticedAt: timestamp("last_practiced_at"),
  },
  (table) => ({
    userSentenceIdx: uniqueIndex("sentence_learning_stats_user_sentence_idx").on(table.userId, table.sentenceId),
  }),
);

export const courseProgress = pgTable(
  "course_progress",
  {
    ...baseColumns(),
    userId: text("user_id").notNull(),
    courseId: pgBigint("course_id", { mode: "bigint" }).notNull().references(() => courses.id),
    completionRate: numeric("completion_rate").notNull().default("0"),
    averageAccuracy: numeric("average_accuracy"),
    practiceRounds: integer("practice_rounds").notNull().default(0),
    weakSentenceIds: jsonb("weak_sentence_ids").$type<string[]>().notNull().default([]),
    status: text("status").notNull().default("unlocked"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    userCourseIdx: uniqueIndex("course_progress_user_course_idx").on(table.userId, table.courseId),
    statusIdx: index("course_progress_status_idx").on(table.userId, table.status),
  }),
);

export const courseReports = pgTable(
  "course_reports",
  {
    id: pgBigint("id", { mode: "bigint" }).primaryKey(),
    userId: text("user_id").notNull(),
    courseId: pgBigint("course_id", { mode: "bigint" }).notNull().references(() => courses.id),
    practicedSentenceCount: integer("practiced_sentence_count").notNull().default(0),
    averageAccuracy: numeric("average_accuracy"),
    averageSpeedRatio: numeric("average_speed_ratio"),
    bestSentenceId: pgBigint("best_sentence_id", { mode: "bigint" }).references(() => corpusSentences.id),
    weakSentenceIds: jsonb("weak_sentence_ids").$type<string[]>().notNull().default([]),
    activatedWordIds: jsonb("activated_word_ids").$type<string[]>().notNull().default([]),
    reportPayload: jsonb("report_payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    userCourseIdx: index("course_reports_user_course_idx").on(table.userId, table.courseId, table.createdAt),
  }),
);

export const userLearningStats = pgTable(
  "user_learning_stats",
  {
    ...baseColumns(),
    userId: text("user_id").notNull(),
    practicedSentenceCount: integer("practiced_sentence_count").notNull().default(0),
    repeatAttemptCount: integer("repeat_attempt_count").notNull().default(0),
    practiceDurationSeconds: integer("practice_duration_seconds").notNull().default(0),
    streakDays: integer("streak_days").notNull().default(0),
    accuracyTrend: jsonb("accuracy_trend").$type<Record<string, unknown>[]>().notNull().default([]),
    completedCourseCount: integer("completed_course_count").notNull().default(0),
    unlockedSceneCount: integer("unlocked_scene_count").notNull().default(0),
  },
  (table) => ({
    userIdx: uniqueIndex("user_learning_stats_user_idx").on(table.userId),
  }),
);
