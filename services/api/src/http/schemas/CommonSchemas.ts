import { z } from "zod";

export const snowflakeIdSchema = z.string().regex(/^[0-9]+$/);

export const emptyResponseSchema = z.null();

const jsonScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonValueSchema = z.union([jsonScalarSchema, z.array(jsonScalarSchema), z.record(jsonScalarSchema)]);

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: jsonValueSchema.optional(),
});
