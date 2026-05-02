import { z } from "zod";
import { learningSteps, progressStatuses } from "../../domain/Enums.js";

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
  continueLearning: z
    .object({
      id: z.string(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      userId: z.string(),
      contentUnitId: z.string(),
      currentStep: z.enum(learningSteps),
      status: z.enum(progressStatuses),
    })
    .nullable()
    .optional(),
  units: z.array(homeUnitCardSchema),
});
