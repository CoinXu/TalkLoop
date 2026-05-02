import { z } from "zod";

export const snowflakeIdSchema = z.string().regex(/^[0-9]+$/);

export const unitIdParamsSchema = z.object({
  unitId: snowflakeIdSchema,
});

export const emptyResponseSchema = z.null();

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
