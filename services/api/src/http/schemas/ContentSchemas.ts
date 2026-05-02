import { z } from "zod";
import { licenseStatuses, sourceTypes } from "../../domain/Enums.js";
import { snowflakeIdSchema } from "./CommonSchemas.js";

export const audioAssetRequestSchema = z.object({
  url: z.string().url(),
  durationSeconds: z.number().int().positive(),
  format: z.string().min(1),
  uploadedBy: z.string().min(1),
});

export const transcriptSegmentRequestSchema = z.object({
  segmentId: snowflakeIdSchema.optional(),
  englishText: z.string().min(1),
  chineseText: z.string().optional(),
  speaker: z.string().optional(),
  segmentOrder: z.number().int().nonnegative(),
});

export const targetSentenceRequestSchema = z.object({
  targetSentenceId: snowflakeIdSchema.optional(),
  englishText: z.string().min(1),
  chinesePrompt: z.string().min(1),
  includesExpression: z.boolean(),
  segmentId: snowflakeIdSchema,
});

export const speakingPromptRequestSchema = z.object({
  speakingPromptId: snowflakeIdSchema.optional(),
  chineseScenario: z.string().min(1),
  englishPromptGap: z.string().min(1),
  targetExpression: z.string().min(1),
  expectedAnswer: z.string().min(1),
});

export const createContentUnitRequestSchema = z.object({
  title: z.string().min(1),
  expression: z.string().min(1),
  expressionMeaning: z.string().min(1),
  difficulty: z.string().min(1),
  sceneTags: z.array(z.string()).default([]),
  estimatedMinutes: z.number().int().positive().default(5),
  sourceType: z.enum(sourceTypes),
  sourceUrl: z.string().url().optional(),
  licenseStatus: z.enum(licenseStatuses).optional(),
  audioAsset: audioAssetRequestSchema.optional(),
  transcriptSegments: z.array(transcriptSegmentRequestSchema).optional(),
  targetSentences: z.array(targetSentenceRequestSchema).optional(),
  speakingPrompts: z.array(speakingPromptRequestSchema).optional(),
});

export const createContentUnitResponseSchema = z.object({
  unitId: z.string(),
});

export const importBbcRequestSchema = z.object({
  sourceUrl: z.string().url(),
});

export const importBbcResponseSchema = z.object({
  jobId: z.string(),
  unitId: z.string().optional(),
});

export const autoSyncResponseSchema = z.object({
  unitId: z.string(),
});
