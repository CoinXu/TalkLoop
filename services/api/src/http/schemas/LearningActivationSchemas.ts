import { z } from "zod";
import { snowflakeIdSchema } from "./CommonSchemas.js";

const jsonScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonArraySchema = z.array(jsonScalarSchema);
export const jsonValueSchema = z.union([jsonScalarSchema, jsonArraySchema, z.record(z.union([jsonScalarSchema, jsonArraySchema]))]);
export const jsonObjectSchema = z.record(z.unknown());

export const listQuerySchema = z.object({
  keyword: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  publishStatus: z.enum(["draft", "published", "unpublished", "archived"]).optional(),
  reviewStatus: z.enum(["pending_review", "approved", "rejected"]).optional(),
  status: z.string().min(1).optional(),
});

export const courseListQuerySchema = listQuerySchema.extend({
  level: z.coerce.number().int().min(1).max(4).optional(),
  sceneId: snowflakeIdSchema.optional(),
});

export const sentenceListQuerySchema = listQuerySchema.extend({
  audioStatus: z.enum(["missing", "ready", "failed", "default", "unreachable"]).optional(),
  courseId: snowflakeIdSchema.optional(),
  difficultyLevel: z.coerce.number().int().min(1).max(4).optional(),
  hasAudio: z.coerce.boolean().optional(),
  sceneTag: z.string().min(1).optional(),
  sceneId: snowflakeIdSchema.optional(),
  targetWord: z.string().min(1).optional(),
});

export const annotationListQuerySchema = listQuerySchema.extend({
  algorithmVersion: z.string().min(1).optional(),
  targetId: snowflakeIdSchema.optional(),
  targetType: z.enum(["word", "sentence"]).optional(),
  taskType: z.enum(["hearing_trap", "distractors", "target_words", "phrase_chunks", "audio"]).optional(),
});

export const annotationResultListQuerySchema = listQuerySchema.extend({
  algorithmVersion: z.string().min(1).optional(),
  maxConfidence: z.coerce.number().min(0).max(1).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  resultStatus: z.enum(["auto_approved", "pending_review", "approved", "rejected", "edited"]).optional(),
  resultType: z.enum(["hearing_trap", "distractors", "target_words", "phrase_chunks"]).optional(),
  targetId: snowflakeIdSchema.optional(),
  targetType: z.enum(["word", "sentence"]).optional(),
  taskId: snowflakeIdSchema.optional(),
  trapType: z.string().min(1).optional(),
});

export const userListQuerySchema = z.object({
  dueOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  skipCountMin: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["red", "yellow", "green"]).optional(),
  source: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  wordId: snowflakeIdSchema.optional(),
});

export const continueLearningQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(10).default(6),
});

export const versionedConfigListQuerySchema = listQuerySchema.extend({
  version: z.string().min(1).optional(),
});

export const listenRepeatListQuerySchema = z.object({
  asrStatus: z.enum(["pending", "succeeded", "failed"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  maxTextMatchRate: z.coerce.number().min(0).max(1).optional(),
  minTextMatchRate: z.coerce.number().min(0).max(1).optional(),
  mode: z.enum(["A", "B", "C"]).optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
  sentenceId: snowflakeIdSchema.optional(),
  textMatchLevel: z.enum(["accurate", "partial", "low"]).optional(),
  userId: z.string().min(1).optional(),
});

export const courseReportListQuerySchema = z.object({
  courseId: snowflakeIdSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  maxAverageAccuracy: z.coerce.number().min(0).max(1).optional(),
  minAverageAccuracy: z.coerce.number().min(0).max(1).optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
  userId: z.string().min(1).optional(),
});

export const idParamsSchema = z.object({ id: snowflakeIdSchema });
export const dateQuerySchema = z.object({ taskDate: z.string().min(8).optional() });

export const sceneRequestSchema = z.object({
  description: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  publishStatus: z.enum(["draft", "published", "unpublished", "archived"]).optional(),
  reason: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});
export const createSceneRequestSchema = sceneRequestSchema.extend({ name: z.string().min(1) });

export const sceneResponseSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  name: z.string(),
  publishStatus: z.string(),
  sceneId: z.string(),
  slug: z.string().optional(),
  sortOrder: z.number(),
  updatedAt: z.string(),
});
export const sceneListResponseSchema = z.object({ items: z.array(sceneResponseSchema) });

export const courseRequestSchema = z.object({
  description: z.string().nullable().optional(),
  level: z.number().int().min(1).max(4).optional(),
  maxSentenceCount: z.number().int().positive().optional(),
  minSentenceCount: z.number().int().positive().optional(),
  publishStatus: z.enum(["draft", "published", "unpublished", "archived"]).optional(),
  reason: z.string().min(1).optional(),
  sceneId: snowflakeIdSchema.optional(),
  sortOrder: z.number().int().optional(),
  title: z.string().min(1).optional(),
  unlockPolicy: jsonObjectSchema.optional(),
});
export const createCourseRequestSchema = courseRequestSchema.extend({
  sceneId: snowflakeIdSchema,
  title: z.string().min(1),
});

const publishValidationSchema = z.object({
  errors: z.array(z.string()),
  sentenceCount: z.number(),
  valid: z.boolean(),
  warnings: z.array(z.string()),
});

export const courseResponseSchema = z.object({
  courseId: z.string(),
  createdAt: z.string(),
  description: z.string().nullable(),
  level: z.number(),
  publishStatus: z.string(),
  sceneId: z.string(),
  slug: z.string().optional(),
  maxSentenceCount: z.number().optional(),
  minSentenceCount: z.number().optional(),
  needsRevalidation: z.boolean().optional(),
  sortOrder: z.number(),
  title: z.string(),
  unlockPolicy: jsonObjectSchema,
  updatedAt: z.string(),
  lockReason: z.string().nullable().optional(),
  publishValidation: publishValidationSchema.optional(),
  sentenceCount: z.number().optional(),
  unlocked: z.boolean().optional(),
});
export const courseListResponseSchema = z.object({ items: z.array(courseResponseSchema) });

export const sentenceRequestSchema = z.object({
  audioStatus: z.enum(["missing", "ready", "failed", "default", "unreachable"]).optional(),
  bonusWords: z.array(z.string()).optional(),
  courseId: snowflakeIdSchema.nullable().optional(),
  difficultyLevel: z.number().int().min(1).max(4).optional(),
  normalAudioUrl: z.string().nullable().optional(),
  phraseChunks: z.array(z.string()).optional(),
  importBatchId: z.string().nullable().optional(),
  publishStatus: z.enum(["draft", "published", "unpublished", "archived"]).optional(),
  reason: z.string().min(1).optional(),
  reviewStatus: z.enum(["pending_review", "approved", "rejected"]).optional(),
  sceneId: snowflakeIdSchema.nullable().optional(),
  sceneTags: z.array(z.string()).optional(),
  sentenceText: z.string().min(1).optional(),
  slowAudioUrl: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  targetWords: z.array(z.string()).optional(),
  translationCn: z.string().nullable().optional(),
});
export const createSentenceRequestSchema = sentenceRequestSchema.extend({
  sentenceText: z.string().min(1),
});

export const sentenceResponseSchema = z.object({
  audioStatus: z.string(),
  bonusWords: z.array(z.string()),
  courseId: z.string().nullable(),
  createdAt: z.string(),
  difficultyLevel: z.number(),
  normalAudioUrl: z.string().nullable(),
  phraseChunks: z.array(z.string()),
  publishStatus: z.string(),
  importBatchId: z.string().nullable().optional(),
  reviewStatus: z.string(),
  sceneId: z.string().nullable(),
  sceneTags: z.array(z.string()),
  sentenceId: z.string(),
  sentenceText: z.string(),
  slowAudioUrl: z.string().nullable(),
  sortOrder: z.number(),
  targetWords: z.array(z.string()),
  translationCn: z.string().nullable(),
  updatedAt: z.string(),
});
export const sentenceListResponseSchema = z.object({ items: z.array(sentenceResponseSchema) });

export const annotationTaskRequestSchema = z.object({
  algorithmVersion: z.string().min(1).optional(),
  confidence: z.union([z.string(), z.number()]).nullable().optional(),
  reason: z.string().min(1).optional(),
  result: jsonObjectSchema.optional(),
  targetId: snowflakeIdSchema,
  targetType: z.enum(["word", "sentence"]),
  taskType: z.enum(["hearing_trap", "distractors", "target_words", "phrase_chunks", "audio"]),
});

export const annotationTaskRunRequestSchema = z.object({
  algorithmVersion: z.string().min(1).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  reason: z.string().min(1).optional(),
  ruleVersion: z.string().min(1).optional(),
  targetId: snowflakeIdSchema.optional(),
  targetType: z.enum(["word", "sentence"]),
  taskType: z.enum(["hearing_trap", "distractors", "target_words", "phrase_chunks"]),
});

export const annotationTaskReviewRequestSchema = z.object({
  reason: z.string().min(1).optional(),
  rejectionReason: z.string().nullable().optional(),
  result: jsonObjectSchema.optional(),
  reviewStatus: z.enum(["approved", "rejected", "pending_review"]),
});

export const annotationResultReviewRequestSchema = z.object({
  manualPatch: jsonObjectSchema.optional(),
  reason: z.string().min(1).optional(),
  rejectionReason: z.string().nullable().optional(),
  resultStatus: z.enum(["auto_approved", "pending_review", "approved", "rejected", "edited"]),
});

export const annotationResultBulkReviewRequestSchema = annotationResultReviewRequestSchema.extend({
  annotationResultIds: z.array(snowflakeIdSchema).min(1).max(500),
});

export const annotationTaskResponseSchema = z.object({
  algorithmVersion: z.string(),
  annotationTaskId: z.string(),
  completedAt: z.string().nullable().optional(),
  confidence: z.string().nullable(),
  createdAt: z.string(),
  failedCount: z.number().optional(),
  failureReason: z.string().nullable().optional(),
  inputScope: jsonObjectSchema.optional(),
  lowConfidenceCount: z.number().optional(),
  rejectionReason: z.string().nullable(),
  result: jsonObjectSchema,
  reviewedAt: z.string().nullable(),
  reviewerAdminId: z.string().nullable(),
  reviewStatus: z.string(),
  ruleVersion: z.string().optional(),
  startedAt: z.string().nullable().optional(),
  succeededCount: z.number().optional(),
  targetId: z.string(),
  targetType: z.string(),
  taskStatus: z.string().optional(),
  taskType: z.string(),
  updatedAt: z.string(),
});
export const annotationTaskListResponseSchema = z.object({ items: z.array(annotationTaskResponseSchema) });

export const annotationResultResponseSchema = z.object({
  algorithmVersion: z.string(),
  annotationResultId: z.string(),
  confidence: z.string(),
  createdAt: z.string(),
  manualPatch: jsonObjectSchema,
  payload: jsonObjectSchema,
  proposedPatch: jsonObjectSchema,
  rejectionReason: z.string().nullable(),
  resultStatus: z.string(),
  resultType: z.string(),
  reviewedAt: z.string().nullable(),
  reviewerAdminId: z.string().nullable(),
  ruleVersion: z.string(),
  severity: z.string(),
  targetId: z.string(),
  targetType: z.string(),
  taskId: z.string(),
  trapType: z.string().nullable(),
  updatedAt: z.string(),
});
export const annotationResultListResponseSchema = z.object({ items: z.array(annotationResultResponseSchema) });
export const annotationBulkReviewResponseSchema = z.object({ applied: z.number(), resultStatus: z.string(), updated: z.number() });

export const selfDescriptionSubmitRequestSchema = z.object({
  answers: z.array(jsonValueSchema).optional(),
  frequencyBoundary: jsonObjectSchema.optional(),
  painPoints: z.array(z.string()).optional(),
  vocabularyEstimate: z.number().int().min(500).max(7500).optional(),
});

export const assessmentSessionStartRequestSchema = z.object({
  painPoints: z.array(z.string()).optional(),
  selfDescription: jsonObjectSchema.optional(),
  vocabularyEstimate: z.number().int().min(500).max(7500).optional(),
});

export const assessmentAnswerSubmitRequestSchema = z.object({
  answers: z.array(z.object({
    assessmentItemId: snowflakeIdSchema,
    selectedOption: z.string().min(1).optional(),
  })).min(1).max(10),
});

export const assessmentConfigRequestSchema = z.object({
  estimateMatrix: jsonObjectSchema.optional(),
  reason: z.string().min(1).optional(),
  samplingStrategy: jsonObjectSchema.optional(),
  selfDescriptionQuestions: z.array(jsonObjectSchema).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  version: z.string().min(1),
});

export const assessmentConfigResponseSchema = z.object({
  assessmentConfigId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  estimateMatrix: jsonObjectSchema,
  samplingStrategy: jsonObjectSchema,
  selfDescriptionQuestions: z.array(jsonObjectSchema),
  status: z.string().optional(),
  updatedAt: z.string().optional(),
  version: z.string().optional(),
});
export const assessmentConfigListResponseSchema = z.object({ items: z.array(assessmentConfigResponseSchema) });

export const assessmentResultResponseSchema = z.object({
  assessmentResultId: z.string(),
  configId: z.string().nullable(),
  createdAt: z.string(),
  frequencyBoundary: jsonObjectSchema,
  generatedVocabularyCount: z.number(),
  painPoints: z.array(z.string()),
  source: z.string(),
  status: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
  verificationRounds: z.array(jsonObjectSchema),
  vocabularyEstimate: z.number(),
});

const assessmentRoundItemResponseSchema = z.object({
  answered: z.boolean(),
  assessmentItemId: z.string(),
  bandKey: z.string(),
  difficultyLevel: z.number().nullable(),
  isCorrect: z.boolean().nullable(),
  itemIndex: z.number(),
  lg10wf: z.string().nullable(),
  options: z.array(z.string()),
  roundIndex: z.number(),
  selectedOption: z.string().nullable(),
  word: z.string(),
  wordId: z.string(),
});

export const assessmentSessionResponseSchema = z.object({
  assessmentResult: jsonObjectSchema.optional(),
  assessmentSessionId: z.string(),
  assessmentVersion: z.string(),
  completedAt: z.string().nullable(),
  configId: z.string().nullable(),
  createdAt: z.string(),
  currentBand: z.string(),
  currentRound: z.number(),
  currentRoundItems: z.array(assessmentRoundItemResponseSchema),
  expiresAt: z.string(),
  maxRounds: z.number(),
  minRounds: z.number(),
  painPoints: z.array(z.string()),
  progress: jsonObjectSchema,
  questionsPerRound: z.number(),
  resultId: z.string().nullable(),
  resultPayload: jsonObjectSchema,
  selfDescription: jsonObjectSchema,
  startedAt: z.string(),
  status: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
});

export const vocabularyOverviewResponseSchema = z.object({
  activationRate: z.number(),
  green: z.number(),
  red: z.number(),
  total: z.number(),
  yellow: z.number(),
});

export const userVocabularyResponseSchema = z.object({
  activationStatus: z.string(),
  audioUrl: z.string().nullable().optional(),
  avoidUntil: z.string().nullable(),
  consecutiveCorrect: z.number(),
  createdAt: z.string(),
  difficultyLevel: z.number().nullable().optional(),
  failureCount: z.number(),
  frequencyCount: z.number().nullable().optional(),
  lastPracticeType: z.string().nullable(),
  lemma: z.string().optional(),
  lg10wf: z.string().nullable().optional(),
  meaningCn: z.string().nullable().optional(),
  nextReviewAt: z.string().nullable(),
  phonetic: z.string().nullable().optional(),
  sentenceExposures: z.number(),
  senses: z.array(z.object({
    antonyms: z.array(z.string()),
    definition: z.string(),
    definitionIndex: z.number(),
    example: z.string().nullable(),
    partOfSpeech: z.string(),
    senseIndex: z.number(),
    source: z.string(),
    synonyms: z.array(z.string()),
    wordSenseId: z.string(),
  })).optional(),
  skipCount: z.number(),
  source: z.string(),
  spokenCount: z.number(),
  srsIntervalDays: z.number(),
  totalAttempts: z.number(),
  totalCorrect: z.number(),
  updatedAt: z.string(),
  userId: z.string(),
  userVocabularyEntryId: z.string(),
  weakPronunciations: z.array(z.string()),
  word: z.string().optional(),
  wordId: z.string(),
});
export const userVocabularyListResponseSchema = z.object({ items: z.array(userVocabularyResponseSchema) });

export const continueLearningItemResponseSchema = userVocabularyResponseSchema.extend({
  practiceType: z.enum(["audio_meaning", "review"]),
  prioritySource: z.enum(["due_review", "yellow_consolidation", "red_activation", "next_unlocked_batch"]),
});
export const continueLearningResponseSchema = z.object({
  emptyReasons: z.array(z.string()),
  hasMore: z.boolean(),
  items: z.array(continueLearningItemResponseSchema),
  limit: z.number(),
});

export const userVocabularyCorrectionRequestSchema = z.object({
  activationStatus: z.enum(["red", "yellow", "green"]),
  metadata: jsonObjectSchema.optional(),
  reason: z.string().min(1),
  userId: z.string().min(1),
  wordId: snowflakeIdSchema,
});

export const activationAttemptRequestSchema = z.object({
  correctAnswer: z.string().nullable().optional(),
  isCorrect: z.boolean(),
  practiceType: z.enum(["audio_meaning", "sentence_word", "repeat_activation", "review"]),
  replayCount: z.number().int().nonnegative().optional(),
  result: jsonObjectSchema.optional(),
  ruleVersion: z.string().min(1).optional(),
  selectedAnswer: z.string().nullable().optional(),
  sentenceId: snowflakeIdSchema.nullable().optional(),
  wordId: snowflakeIdSchema.nullable().optional(),
});

export const activationAttemptResponseSchema = z.object({
  activationAttemptId: z.string(),
  correctAnswer: z.string().nullable(),
  createdAt: z.string(),
  isCorrect: z.boolean(),
  practiceType: z.string(),
  replayCount: z.number(),
  result: jsonObjectSchema,
  ruleVersion: z.string(),
  selectedAnswer: z.string().nullable(),
  sentenceId: z.string().nullable(),
  userId: z.string(),
  vocabularyUpdate: userVocabularyResponseSchema.nullable(),
  wordId: z.string().nullable(),
});

export const versionedRulesRequestSchema = z.object({
  reason: z.string().min(1).optional(),
  rules: jsonObjectSchema.optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  version: z.string().min(1),
});

export const practiceRuleResponseSchema = z.object({
  createdAt: z.string(),
  practiceRuleId: z.string(),
  rules: jsonObjectSchema,
  status: z.string(),
  updatedAt: z.string(),
  version: z.string(),
});
export const practiceRuleListResponseSchema = z.object({ items: z.array(practiceRuleResponseSchema) });

export const dailyTaskStrategyResponseSchema = z.object({
  createdAt: z.string(),
  dailyTaskStrategyId: z.string(),
  rules: jsonObjectSchema,
  status: z.string(),
  updatedAt: z.string(),
  version: z.string(),
});
export const dailyTaskStrategyListResponseSchema = z.object({ items: z.array(dailyTaskStrategyResponseSchema) });

export const dailyTaskItemResponseSchema = z.object({
  createdAt: z.string(),
  dailyTaskId: z.string(),
  dailyTaskItemId: z.string(),
  itemType: z.string(),
  priorityScore: z.string(),
  sentenceId: z.string().nullable(),
  status: z.string(),
  updatedAt: z.string(),
  wordId: z.string().nullable(),
});

export const dailyTaskResponseSchema = z.object({
  createdAt: z.string(),
  dailyTaskId: z.string(),
  generationLog: jsonObjectSchema,
  items: z.array(dailyTaskItemResponseSchema),
  status: z.string(),
  strategyVersion: z.string(),
  summary: jsonObjectSchema,
  taskDate: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
});

export const dailyTaskResetResponseSchema = z.object({
  deletedTaskItems: z.number(),
  deletedTasks: z.number(),
  reset: z.boolean(),
  taskDate: z.string(),
});

export const listenRepeatAttemptRequestSchema = z.object({
  asrStatus: z.enum(["pending", "succeeded", "failed"]).optional(),
  failureReason: z.string().nullable().optional(),
  mode: z.enum(["A", "B", "C"]),
  originalAudioDurationMs: z.number().int().positive().nullable().optional(),
  phraseChunkIndex: z.number().int().nonnegative().nullable().optional(),
  recordingDurationMs: z.number().int().positive().nullable().optional(),
  recordingUrl: z.string().nullable().optional(),
  sentenceId: snowflakeIdSchema,
  targetWordHits: z.array(z.string()).optional(),
  textMatchRate: z.union([z.string(), z.number()]).nullable().optional(),
  transcript: z.string().nullable().optional(),
  waveformSummary: jsonObjectSchema.optional(),
});

export const listenRepeatAttemptResponseSchema = z.object({
  asrStatus: z.string(),
  createdAt: z.string(),
  failureReason: z.string().nullable(),
  listenRepeatAttemptId: z.string(),
  mode: z.string(),
  originalAudioDurationMs: z.number().nullable(),
  phraseChunkIndex: z.number().nullable(),
  recordingDurationMs: z.number().nullable(),
  recordingUrl: z.string().nullable(),
  sentenceId: z.string(),
  speedRatio: z.string().nullable(),
  targetWordHits: z.array(z.string()),
  textMatchLevel: z.string().nullable(),
  textMatchRate: z.string().nullable(),
  transcript: z.string().nullable(),
  userId: z.string(),
  vocabularyUpdates: z.array(userVocabularyResponseSchema).optional(),
  waveformSummary: jsonObjectSchema,
});
export const listenRepeatAttemptListResponseSchema = z.object({ items: z.array(listenRepeatAttemptResponseSchema) });

export const courseReportRequestSchema = z.object({
  activatedWordIds: z.array(snowflakeIdSchema).optional(),
  averageAccuracy: z.union([z.string(), z.number()]).nullable().optional(),
  averageSpeedRatio: z.union([z.string(), z.number()]).nullable().optional(),
  bestSentenceId: snowflakeIdSchema.nullable().optional(),
  courseId: snowflakeIdSchema,
  practicedSentenceCount: z.number().int().nonnegative().optional(),
  reportPayload: jsonObjectSchema.optional(),
  weakSentenceIds: z.array(snowflakeIdSchema).optional(),
});

export const courseReportResponseSchema = z.object({
  activatedWordIds: z.array(z.string()),
  averageAccuracy: z.string().nullable(),
  averageSpeedRatio: z.string().nullable(),
  bestSentenceId: z.string().nullable(),
  courseId: z.string(),
  courseReportId: z.string(),
  createdAt: z.string(),
  practicedSentenceCount: z.number(),
  reportPayload: jsonObjectSchema,
  userId: z.string(),
  weakSentenceIds: z.array(z.string()),
});
export const courseReportListResponseSchema = z.object({ items: z.array(courseReportResponseSchema) });
