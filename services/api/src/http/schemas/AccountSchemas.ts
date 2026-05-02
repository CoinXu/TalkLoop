import { z } from "zod";

export const requestOtpRequestSchema = z.object({
  destination: z.string().min(3),
});

export const requestOtpResponseSchema = z.object({
  destination: z.string(),
  deliveryChannel: z.enum(["email", "phone"]),
  expiresInSeconds: z.number().int().positive(),
});

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

export const currentUserResponseSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  isInternalTester: z.boolean(),
  expiresAt: z.string().datetime(),
});
