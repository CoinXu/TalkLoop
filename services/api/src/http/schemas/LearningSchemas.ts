import { z } from "zod";
import { learningSteps, progressStatuses } from "../../domain/Enums.js";

export const saveProgressRequestSchema = z.object({
  currentStep: z.enum(learningSteps),
  status: z.enum(progressStatuses),
});

export const learningUnitResponseSchema = z.object({
  unit: z.record(z.unknown()),
  audio: z.record(z.unknown()).nullable().optional(),
  segments: z.array(z.record(z.unknown())),
  targets: z.array(z.record(z.unknown())),
  prompts: z.array(z.record(z.unknown())),
  synced: z.array(z.record(z.unknown())),
  progress: z.record(z.unknown()).nullable().optional(),
});

export const progressResponseSchema = z.record(z.unknown());
