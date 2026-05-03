import { z } from "zod";
import { snowflakeIdSchema } from "./CommonSchemas.js";

export const adminLoginRequestSchema = z.object({
  loginName: z.string().min(1),
  password: z.string().min(1),
});

export const adminAuthResponseSchema = z.object({
  adminSessionId: z.string(),
  adminUserId: z.string(),
  adminRole: z.string(),
  displayName: z.string(),
  expiresAt: z.string(),
  loginName: z.string(),
  permissionKeys: z.array(z.string()),
});

export const adminMeResponseSchema = z.object({
  adminUserId: z.string(),
  adminRole: z.string(),
  displayName: z.string(),
  loginName: z.string(),
  permissionKeys: z.array(z.string()),
});

export const adminListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const adminAccountListQuerySchema = adminListQuerySchema.extend({
  keyword: z.string().min(1).optional(),
  role: z.literal("super_admin").optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
});

export const adminAuditLogListQuerySchema = adminListQuerySchema.extend({
  action: z.string().min(1).optional(),
  adminUserId: snowflakeIdSchema.optional(),
  objectId: z.string().min(1).optional(),
  objectType: z.string().min(1).optional(),
  permissionKey: z.string().min(1).optional(),
});

export const adminAccountParamsSchema = z.object({
  id: snowflakeIdSchema,
});

export const createAdminAccountRequestSchema = z.object({
  loginName: z.string().min(1),
  displayName: z.string().min(1),
  role: z.literal("super_admin"),
  reason: z.string().min(1).optional(),
});

export const updateAdminAccountRequestSchema = z.object({
  displayName: z.string().min(1).optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  reason: z.string().min(1).optional(),
});

export const resetAdminPasswordRequestSchema = z.object({
  reason: z.string().min(1).optional(),
});

export const adminUserResponseSchema = z.object({
  adminUserId: z.string(),
  createdAt: z.string(),
  createdByAdminId: z.string().nullable(),
  displayName: z.string(),
  lastLoginAt: z.string().nullable(),
  loginName: z.string(),
  role: z.string(),
  status: z.string(),
  updatedAt: z.string(),
  updatedByAdminId: z.string().nullable(),
});

export const createAdminAccountResponseSchema = z.object({
  temporaryPassword: z.string(),
  user: adminUserResponseSchema,
});

export const resetAdminPasswordResponseSchema = z.object({
  temporaryPassword: z.string(),
  user: adminUserResponseSchema,
});

export const adminAccountListResponseSchema = z.object({
  items: z.array(adminUserResponseSchema),
});

const auditValueSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string()), z.record(z.string())]));

export const adminAuditLogResponseSchema = z.object({
  action: z.string(),
  adminRole: z.string(),
  adminUserId: z.string().nullable(),
  auditLogId: z.string(),
  createdAt: z.string(),
  newValue: auditValueSchema.nullable().optional(),
  objectId: z.string().nullable().optional(),
  objectType: z.string(),
  oldValue: auditValueSchema.nullable().optional(),
  permissionKey: z.string(),
  reason: z.string().nullable().optional(),
});

export const adminAuditLogListResponseSchema = z.object({
  items: z.array(adminAuditLogResponseSchema),
});
