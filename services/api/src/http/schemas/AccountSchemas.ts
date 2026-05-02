import { z } from "zod";

export const loginRequestSchema = z.object({
  destination: z.string().min(3),
  otpCode: z.string().min(4).max(12),
});

export const loginResponseSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  isInternalTester: z.boolean(),
  expiresAt: z.string().datetime(),
});
