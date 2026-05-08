import { z } from "zod";
import { snowflakeIdSchema } from "./CommonSchemas.js";
import { jsonObjectSchema } from "./LearningActivationSchemas.js";

const contentStatusSchema = z.enum(["draft", "published", "unpublished", "archived"]);
const audioStatusSchema = z.enum(["missing", "ready", "failed", "default", "unreachable"]);

export const contentListQuerySchema = z.object({
  assigned: z.coerce.boolean().optional(),
  audioStatus: audioStatusSchema.optional(),
  courseId: snowflakeIdSchema.optional(),
  difficultyLevel: z.coerce.number().int().min(1).max(8).optional(),
  hasAudio: z.coerce.boolean().optional(),
  keyword: z.string().min(1).optional(),
  level: z.coerce.number().int().min(1).max(8).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  sceneId: snowflakeIdSchema.optional(),
  sceneTag: z.string().min(1).optional(),
  status: contentStatusSchema.optional(),
  targetWord: z.string().min(1).optional(),
});

export const contentIdParamsSchema = z.object({ id: snowflakeIdSchema });
export const contentImportParamsSchema = z.object({ importBatchId: z.string().min(1) });

export const contentSceneRequestSchema = z.object({
  description: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  status: contentStatusSchema.optional(),
});
export const createContentSceneRequestSchema = contentSceneRequestSchema.extend({ name: z.string().min(1) });

export const contentCourseRequestSchema = z.object({
  description: z.string().nullable().optional(),
  level: z.number().int().min(1).max(8).optional(),
  maxSentenceCount: z.number().int().positive().optional(),
  minSentenceCount: z.number().int().positive().optional(),
  needsRevalidation: z.boolean().optional(),
  reason: z.string().min(1).optional(),
  sceneId: snowflakeIdSchema.optional(),
  slug: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  status: contentStatusSchema.optional(),
  title: z.string().min(1).optional(),
  unlockPolicy: jsonObjectSchema.optional(),
});
export const createContentCourseRequestSchema = contentCourseRequestSchema.extend({
  sceneId: snowflakeIdSchema,
  title: z.string().min(1),
});

export const contentSentenceRequestSchema = z.object({
  audioStatus: audioStatusSchema.optional(),
  bonusWords: z.array(z.string()).optional(),
  courseId: snowflakeIdSchema.nullable().optional(),
  difficultyLevel: z.number().int().min(1).max(8).optional(),
  importBatchId: z.string().nullable().optional(),
  normalAudioUrl: z.string().nullable().optional(),
  phraseChunks: z.array(z.string()).optional(),
  reason: z.string().min(1).optional(),
  reviewStatus: z.string().min(1).optional(),
  sceneId: snowflakeIdSchema.nullable().optional(),
  sceneTags: z.array(z.string()).optional(),
  sentenceText: z.string().min(1).optional(),
  slowAudioUrl: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  status: contentStatusSchema.optional(),
  targetWords: z.array(z.string()).optional(),
  translationCn: z.string().nullable().optional(),
});
export const createContentSentenceRequestSchema = contentSentenceRequestSchema.extend({
  sentenceText: z.string().min(1),
});

export const contentBatchStatusRequestSchema = z.object({
  ids: z.array(snowflakeIdSchema),
  objectType: z.enum(["scene", "course", "sentence"]),
  reason: z.string().min(1).optional(),
  status: contentStatusSchema,
});

export const contentCompositionRequestSchema = z.object({
  addSentenceIds: z.array(snowflakeIdSchema).optional(),
  keepSceneIdOnRemove: z.boolean().optional(),
  orderedSentenceIds: z.array(snowflakeIdSchema).optional(),
  reason: z.string().min(1).optional(),
  removeSentenceIds: z.array(snowflakeIdSchema).optional(),
});

const importRowSchema = contentSentenceRequestSchema.extend({
  sentenceId: snowflakeIdSchema.optional(),
  sentenceText: z.string().min(1).optional(),
});

export const contentImportRequestSchema = z.object({
  importBatchId: z.string().min(1).optional(),
  rows: z.union([z.array(importRowSchema), z.string().min(1)]).optional(),
  data: z.string().min(1).optional(),
  file: z.unknown().optional(),
}).passthrough();

export const defaultAudioRequestSchema = z.object({
  configured: z.boolean(),
  normalAudioUrl: z.string().nullable().optional(),
  reason: z.string().min(1).optional(),
  slowAudioUrl: z.string().nullable().optional(),
});

export const publishValidationRequestSchema = z.object({
  objectId: snowflakeIdSchema.optional(),
  objectType: z.enum(["scene", "course", "sentence"]).optional(),
  targets: z.array(z.object({
    objectId: snowflakeIdSchema,
    objectType: z.enum(["scene", "course", "sentence"]),
  })).optional(),
});

export const publishRequestSchema = publishValidationRequestSchema.extend({
  reason: z.string().min(1).optional(),
});

export const contentAnyResponseSchema = z.object({}).passthrough();
export const contentListResponseSchema = z.object({ items: z.array(contentAnyResponseSchema) });
