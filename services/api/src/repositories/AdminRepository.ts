import { and, count, desc, eq, gt, ilike } from "drizzle-orm";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import {
  adminAuditLogs,
  adminPermissions,
  adminRolePermissions,
  adminSessions,
  adminUsers,
} from "../infrastructure/database/schema.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import type { EntityId } from "../domain/EntityId.js";

export type AdminUserRow = typeof adminUsers.$inferSelect;
export type AdminSessionRow = typeof adminSessions.$inferSelect;
export type AdminAuditLogRow = typeof adminAuditLogs.$inferSelect;

export interface CreateAdminUserInput {
  loginName: string;
  passwordHash: string;
  displayName: string;
  role: "super_admin";
  createdByAdminId?: EntityId | null;
}

export interface AuditInput {
  adminUserId: EntityId | null;
  adminRole: string;
  permissionKey: string;
  action: string;
  objectType: string;
  objectId?: string | null | undefined;
  oldValue?: Record<string, unknown> | null | undefined;
  newValue?: Record<string, unknown> | null | undefined;
  reason?: string | null | undefined;
}

export interface AdminUserListQuery {
  keyword?: string | undefined;
  role?: "super_admin" | undefined;
  status?: "enabled" | "disabled" | undefined;
  limit: number;
  offset: number;
}

export interface AdminAuditLogListQuery {
  action?: string | undefined;
  adminUserId?: EntityId | undefined;
  objectId?: string | undefined;
  objectType?: string | undefined;
  permissionKey?: string | undefined;
  limit: number;
  offset: number;
}

export class AdminRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly idGenerator: SnowflakeIdGenerator,
  ) {}

  nextId(): EntityId {
    return this.idGenerator.nextId();
  }

  now(): Date {
    return this.idGenerator.now();
  }

  async findByLoginName(loginName: string): Promise<AdminUserRow | undefined> {
    return this.db.query.adminUsers.findFirst({ where: eq(adminUsers.loginName, loginName) });
  }

  async findUserById(id: EntityId): Promise<AdminUserRow | undefined> {
    return this.db.query.adminUsers.findFirst({ where: eq(adminUsers.id, id) });
  }

  async createUser(input: CreateAdminUserInput): Promise<AdminUserRow> {
    const now = this.now();
    const [user] = await this.db
      .insert(adminUsers)
      .values({
        id: this.nextId(),
        loginName: input.loginName,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        role: input.role,
        status: "enabled",
        createdByAdminId: input.createdByAdminId ?? null,
        updatedByAdminId: input.createdByAdminId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!user) {
      throw new Error("Failed to create admin user");
    }
    return user;
  }

  async listUsers(query: AdminUserListQuery): Promise<AdminUserRow[]> {
    const filters = [];
    if (query.keyword) {
      filters.push(ilike(adminUsers.loginName, `%${query.keyword}%`));
    }
    if (query.status) {
      filters.push(eq(adminUsers.status, query.status));
    }
    if (query.role) {
      filters.push(eq(adminUsers.role, query.role));
    }
    return this.db
      .select()
      .from(adminUsers)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(adminUsers.createdAt))
      .limit(query.limit)
      .offset(query.offset);
  }

  async updateUser(
    id: EntityId,
    patch: Partial<Pick<AdminUserRow, "displayName" | "status" | "passwordHash" | "updatedByAdminId" | "lastLoginAt">>,
  ): Promise<{ before: AdminUserRow; after: AdminUserRow | undefined } | undefined> {
    const before = await this.findUserById(id);
    if (!before) {
      return undefined;
    }

    const [after] = await this.db
      .update(adminUsers)
      .set({ ...patch, updatedAt: this.now() })
      .where(eq(adminUsers.id, id))
      .returning();
    return { before, after };
  }

  async enabledSuperAdminCount(): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(adminUsers)
      .where(and(eq(adminUsers.role, "super_admin"), eq(adminUsers.status, "enabled")));
    return row?.value ?? 0;
  }

  async createSession(adminUserId: EntityId): Promise<AdminSessionRow> {
    const now = this.now();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 8);
    const [session] = await this.db
      .insert(adminSessions)
      .values({
        id: this.nextId(),
        adminUserId,
        status: "active",
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!session) {
      throw new Error("Failed to create admin session");
    }
    return session;
  }

  async findActiveSession(id: EntityId): Promise<(AdminSessionRow & { adminUser: AdminUserRow }) | undefined> {
    const [row] = await this.db
      .select({ session: adminSessions, user: adminUsers })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
      .where(and(eq(adminSessions.id, id), eq(adminSessions.status, "active"), gt(adminSessions.expiresAt, this.now())));
    if (!row) {
      return undefined;
    }
    return { ...row.session, adminUser: row.user };
  }

  async revokeSession(id: EntityId): Promise<void> {
    await this.db.update(adminSessions).set({ status: "revoked", updatedAt: this.now() }).where(eq(adminSessions.id, id));
  }

  async permissionsForRole(role: string): Promise<string[]> {
    const rows = await this.db
      .select({ permissionKey: adminPermissions.permissionKey })
      .from(adminRolePermissions)
      .innerJoin(adminPermissions, eq(adminPermissions.permissionKey, adminRolePermissions.permissionKey))
      .where(eq(adminRolePermissions.adminRole, role));
    return rows.map((row) => row.permissionKey);
  }

  async audit(input: AuditInput): Promise<AdminAuditLogRow> {
    const [row] = await this.db
      .insert(adminAuditLogs)
      .values({
        id: this.nextId(),
        adminUserId: input.adminUserId,
        adminRole: input.adminRole,
        permissionKey: input.permissionKey,
        action: input.action,
        objectType: input.objectType,
        objectId: input.objectId ?? null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        reason: input.reason ?? null,
        createdAt: this.now(),
      })
      .returning();
    if (!row) {
      throw new Error("Failed to create admin audit log");
    }
    return row;
  }

  async listAuditLogs(query: AdminAuditLogListQuery): Promise<AdminAuditLogRow[]> {
    const filters = [];
    if (query.action) filters.push(eq(adminAuditLogs.action, query.action));
    if (query.adminUserId) filters.push(eq(adminAuditLogs.adminUserId, query.adminUserId));
    if (query.objectId) filters.push(eq(adminAuditLogs.objectId, query.objectId));
    if (query.objectType) filters.push(eq(adminAuditLogs.objectType, query.objectType));
    if (query.permissionKey) filters.push(eq(adminAuditLogs.permissionKey, query.permissionKey));
    return this.db
      .select()
      .from(adminAuditLogs)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(query.limit)
      .offset(query.offset);
  }
}
