import { z } from "zod";
import { snowflakeIdSchema } from "./CommonSchemas.js";

const decimalStringSchema = z.union([z.string().min(1), z.number()]).transform((value) => String(value));
const nullableDecimalResponseSchema = z.string().nullable();

export const wordDistractorsSchema = z.object({
  pronunciation: z.array(z.string()),
  meaning: z.array(z.string()),
  difficulty: z.array(z.string()),
});

export const wordListQuerySchema = z.object({
  audioStatus: z.enum(["missing", "ready", "failed"]).optional(),
  difficultyLevel: z.coerce.number().int().min(1).max(4).optional(),
  hasAudio: z.coerce.boolean().optional(),
  hasMeaning: z.coerce.boolean().optional(),
  isExcluded: z.coerce.boolean().optional(),
  keyword: z.string().min(1).optional(),
  lemma: z.string().min(1).optional(),
  levelTag: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  maxFrequencyCount: z.coerce.number().int().nonnegative().optional(),
  maxLg10wf: z.coerce.number().optional(),
  minFrequencyCount: z.coerce.number().int().nonnegative().optional(),
  minLg10wf: z.coerce.number().optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
  publishStatus: z.enum(["draft", "published", "archived"]).optional(),
  reviewStatus: z.enum(["pending_review", "approved", "rejected"]).optional(),
  sceneTag: z.string().min(1).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "word", "difficultyLevel", "lg10wf", "frequencyCount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const publicWordListQuerySchema = z.object({
  difficultyLevel: z.coerce.number().int().min(1).max(4).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const subtlexusWordListQuerySchema = z.object({
  importBatchId: z.string().min(1).optional(),
  keyword: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  maxCdCount: z.coerce.number().int().nonnegative().optional(),
  maxFreqCount: z.coerce.number().int().nonnegative().optional(),
  maxLg10Cd: z.coerce.number().optional(),
  maxLg10Wf: z.coerce.number().optional(),
  minCdCount: z.coerce.number().int().nonnegative().optional(),
  minFreqCount: z.coerce.number().int().nonnegative().optional(),
  minLg10Cd: z.coerce.number().optional(),
  minLg10Wf: z.coerce.number().optional(),
  normalizedWord: z.string().min(1).optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
  sourceFileName: z.string().min(1).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "word", "freqCount", "cdCount", "lg10Wf", "lg10Cd"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  word: z.string().min(1).optional(),
});

export const wordParamsSchema = z.object({
  id: snowflakeIdSchema,
});

export const wordEntryBodySchema = z.object({
  audioStatus: z.enum(["missing", "ready", "failed"]).optional(),
  audioUrl: z.string().nullable().optional(),
  cdCount: z.number().int().nonnegative().nullable().optional(),
  cdLow: z.number().int().nonnegative().nullable().optional(),
  commonCollocations: z.array(z.string()).optional(),
  difficultyLevel: z.number().int().min(1).max(4).nullable().optional(),
  distractors: wordDistractorsSchema.optional(),
  exclusionReason: z.string().nullable().optional(),
  frequencyCount: z.number().int().nonnegative().nullable().optional(),
  frequencyLow: z.number().int().nonnegative().nullable().optional(),
  hearingTrap: z.string().nullable().optional(),
  isExcluded: z.boolean().optional(),
  lemma: z.string().min(1).optional(),
  levelTags: z.array(z.string()).optional(),
  lg10cd: decimalStringSchema.nullable().optional(),
  lg10wf: decimalStringSchema.nullable().optional(),
  meaningCn: z.string().nullable().optional(),
  meaningEn: z.string().nullable().optional(),
  partOfSpeech: z.string().nullable().optional(),
  phonetic: z.string().nullable().optional(),
  publishStatus: z.enum(["draft", "published", "archived"]).optional(),
  reason: z.string().min(1).optional(),
  reviewStatus: z.enum(["pending_review", "approved", "rejected"]).optional(),
  sceneTags: z.array(z.string()).optional(),
  subtlcd: decimalStringSchema.nullable().optional(),
  subtlwf: decimalStringSchema.nullable().optional(),
  word: z.string().min(1).optional(),
});

export const createWordEntryBodySchema = wordEntryBodySchema.extend({
  word: z.string().min(1),
});

export const wordPublishBodySchema = z.object({
  publishStatus: z.enum(["draft", "published", "archived"]),
  reason: z.string().min(1).optional(),
});

export const wordFrequencyImportQuerySchema = z.object({
  dryRun: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().positive().max(100000).optional(),
  reason: z.string().min(1).optional(),
});

export const createWordsFromSubtlexusBodySchema = z
  .object({
    excludeExisting: z.boolean().default(true),
    maxRows: z.number().int().positive().max(5000).default(500),
    minLg10Wf: z.number().optional(),
    reason: z.string().min(1).optional(),
    words: z.array(z.string().min(1)).max(5000).optional(),
  })
  .refine((value) => value.words?.length || value.minLg10Wf !== undefined, {
    message: "Either words or minLg10Wf is required",
    path: ["words"],
  });

export const publicWordResponseSchema = z.object({
  audioUrl: z.string().nullable(),
  difficultyLevel: z.number().nullable(),
  meaningCn: z.string().nullable(),
  meaningEn: z.string().nullable(),
  phonetic: z.string().nullable(),
  sceneTags: z.array(z.string()),
  word: z.string(),
  wordId: z.string(),
});

export const adminWordResponseSchema = z.object({
  audioStatus: z.string(),
  audioUrl: z.string().nullable(),
  cdCount: z.number().nullable(),
  cdLow: z.number().nullable(),
  commonCollocations: z.array(z.string()),
  createdAt: z.string(),
  difficultyLevel: z.number().nullable(),
  distractors: wordDistractorsSchema,
  exclusionReason: z.string().nullable(),
  frequencyCount: z.number().nullable(),
  frequencyLow: z.number().nullable(),
  hearingTrap: z.string().nullable(),
  isExcluded: z.boolean(),
  lemma: z.string(),
  levelTags: z.array(z.string()),
  lg10cd: nullableDecimalResponseSchema,
  lg10wf: nullableDecimalResponseSchema,
  meaningCn: z.string().nullable(),
  meaningEn: z.string().nullable(),
  partOfSpeech: z.string().nullable(),
  phonetic: z.string().nullable(),
  publishStatus: z.string(),
  reviewStatus: z.string(),
  sceneTags: z.array(z.string()),
  subtlcd: nullableDecimalResponseSchema,
  subtlwf: nullableDecimalResponseSchema,
  updatedAt: z.string(),
  word: z.string(),
  wordId: z.string(),
});

export const subtlexusWordResponseSchema = z.object({
  cdCount: z.number().nullable(),
  cdLow: z.number().nullable(),
  createdAt: z.string(),
  freqCount: z.number().nullable(),
  freqLow: z.number().nullable(),
  importBatchId: z.string(),
  lg10Cd: nullableDecimalResponseSchema,
  lg10Wf: nullableDecimalResponseSchema,
  normalizedWord: z.string(),
  sourceFileName: z.string(),
  subtlCd: nullableDecimalResponseSchema,
  subtlWf: nullableDecimalResponseSchema,
  subtlexusWordId: z.string(),
  updatedAt: z.string(),
  word: z.string(),
});

export const subtlexusWordListResponseSchema = z.object({ items: z.array(subtlexusWordResponseSchema) });

export const publicWordListResponseSchema = z.object({ items: z.array(publicWordResponseSchema) });
export const adminWordListResponseSchema = z.object({ items: z.array(adminWordResponseSchema) });

export const wordFrequencyImportResponseSchema = z.object({
  created: z.number(),
  dryRun: z.boolean(),
  fileName: z.string(),
  importBatchId: z.string(),
  importableRows: z.number(),
  skippedRows: z.number(),
  total: z.number().optional(),
  totalRows: z.number(),
  updated: z.number(),
});

export const createWordsFromSubtlexusResponseSchema = z.object({
  created: z.number(),
  skippedExisting: z.number(),
  source: z.literal("subtlexus"),
});
