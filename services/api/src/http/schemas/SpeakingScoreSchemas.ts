import { z } from "zod";
import { scoreTargetTypes } from "../../domain/Enums.js";
import { snowflakeIdSchema } from "./CommonSchemas.js";

export const submitScoreRequestSchema = z.object({
  unitId: snowflakeIdSchema,
  scoreTargetType: z.enum(scoreTargetTypes),
  targetId: snowflakeIdSchema,
  targetText: z.string().min(1),
  recordingBase64: z.string().min(1),
  recordingMimeType: z.string().min(1),
});

export const scoreRecordResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  contentUnitId: z.string(),
  scoreTargetType: z.enum(scoreTargetTypes),
  targetId: z.string(),
  targetText: z.string(),
  overallScore: z.number(),
  pronunciationScore: z.number().nullable().optional(),
  fluencyScore: z.number().nullable().optional(),
  completenessScore: z.number().nullable().optional(),
  recordingUrl: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
