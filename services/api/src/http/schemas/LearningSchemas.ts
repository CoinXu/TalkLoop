import { z } from "zod";
import {
  learningSteps,
  licenseStatuses,
  progressStatuses,
  publishStatuses,
  scoreTargetTypes,
  sourceTypes,
  syncStatuses,
} from "../../domain/Enums.js";

export const saveProgressRequestSchema = z.object({
  currentStep: z.enum(learningSteps),
  status: z.enum(progressStatuses),
});

const nullableDateTimeSchema = z.string().datetime().nullable();

const contentUnitSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  title: z.string(),
  expression: z.string(),
  expressionMeaning: z.string(),
  difficulty: z.string(),
  sceneTags: z.array(z.string()),
  estimatedMinutes: z.number().int(),
  sourceType: z.enum(sourceTypes),
  sourceUrl: z.string().nullable(),
  licenseStatus: z.enum(licenseStatuses),
  publishStatus: z.enum(publishStatuses),
  syncStatus: z.enum(syncStatuses),
  publishedAt: nullableDateTimeSchema,
});

const audioAssetSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  contentUnitId: z.string(),
  url: z.string(),
  durationSeconds: z.number().int(),
  format: z.string(),
  uploadedBy: z.string(),
});

const transcriptSegmentSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  contentUnitId: z.string(),
  englishText: z.string(),
  chineseText: z.string().nullable(),
  speaker: z.string().nullable(),
  segmentOrder: z.number().int(),
});

const targetSentenceSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  contentUnitId: z.string(),
  englishText: z.string(),
  chinesePrompt: z.string(),
  includesExpression: z.boolean(),
  transcriptSegmentId: z.string(),
});

const speakingPromptSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  contentUnitId: z.string(),
  chineseScenario: z.string(),
  englishPromptGap: z.string(),
  targetExpression: z.string(),
  expectedAnswer: z.string(),
});

const syncedSegmentSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  contentUnitId: z.string(),
  transcriptSegmentId: z.string(),
  startMs: z.number().int(),
  endMs: z.number().int(),
  englishText: z.string(),
  chineseText: z.string().nullable(),
});

export const progressResponseSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string(),
  contentUnitId: z.string(),
  currentStep: z.enum(learningSteps),
  status: z.enum(progressStatuses),
});

const scoreRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  userId: z.string(),
  contentUnitId: z.string(),
  scoreTargetType: z.enum(scoreTargetTypes),
  targetId: z.string(),
  targetText: z.string(),
  overallScore: z.number().int(),
  pronunciationScore: z.number().int().nullable(),
  fluencyScore: z.number().int().nullable(),
  completenessScore: z.number().int().nullable(),
  recordingUrl: z.string(),
  providerPayload: z.record(z.unknown()).nullable().optional(),
});

export const learningUnitResponseSchema = z.object({
  unit: contentUnitSchema,
  audio: audioAssetSchema.nullable().optional(),
  segments: z.array(transcriptSegmentSchema),
  targets: z.array(targetSentenceSchema),
  prompts: z.array(speakingPromptSchema),
  synced: z.array(syncedSegmentSchema),
  progress: progressResponseSchema.nullable().optional(),
  latestScore: scoreRecordSchema.nullable().optional(),
});
