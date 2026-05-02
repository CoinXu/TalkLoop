import { z } from "zod";

export const homeUnitCardSchema = z.object({
  unitId: z.string(),
  title: z.string(),
  expression: z.string(),
  expressionMeaning: z.string(),
  estimatedMinutes: z.number(),
  difficulty: z.string(),
  completionStatus: z.string(),
  recentScore: z.number().optional(),
  isInternalOnly: z.boolean(),
});

export const homeResponseSchema = z.object({
  continueLearning: z.record(z.unknown()).nullable().optional(),
  units: z.array(homeUnitCardSchema),
});
