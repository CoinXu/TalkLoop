import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { AdminAuditLogListQuery, AdminRepository, AdminUserListQuery, AdminUserRow } from "../repositories/AdminRepository.js";

export interface CurrentAdmin {
  adminUserId: EntityId;
  adminRole: string;
  displayName: string;
  loginName: string;
  permissionKeys: string[];
}

export interface AdminAuthResult extends CurrentAdmin {
  adminSessionId: EntityId;
  expiresAt: Date;
}

export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  async login(loginName: string, password: string): Promise<AdminAuthResult> {
    const user = await this.adminRepository.findByLoginName(loginName);
    if (!user || user.status !== "enabled" || user.passwordHash !== this.hashPassword(password)) {
      throw new AppError("unauthorized", "Invalid admin credentials");
    }

    const session = await this.adminRepository.createSession(user.id);
    await this.adminRepository.updateUser(user.id, { lastLoginAt: this.adminRepository.now() });
    const permissionKeys = await this.adminRepository.permissionsForRole(user.role);
    await this.audit(
      {
        adminRole: user.role,
        adminUserId: user.id,
        displayName: user.displayName,
        loginName: user.loginName,
        permissionKeys,
      },
      "admin.dashboard.read",
      "admin_login",
      "admin_session",
      EntityIdCodec.stringify(session.id),
      undefined,
      { adminSessionId: EntityIdCodec.stringify(session.id) },
    );

    return {
      adminSessionId: session.id,
      adminRole: user.role,
      adminUserId: user.id,
      displayName: user.displayName,
      expiresAt: session.expiresAt,
      loginName: user.loginName,
      permissionKeys,
    };
  }

  async logout(sessionId: EntityId): Promise<void> {
    const current = await this.requireSession(sessionId);
    await this.adminRepository.revokeSession(sessionId);
    await this.audit(current, "admin.dashboard.read", "admin_logout", "admin_session", EntityIdCodec.stringify(sessionId));
  }

  async requireSession(sessionId: EntityId): Promise<CurrentAdmin> {
    const session = await this.adminRepository.findActiveSession(sessionId);
    if (!session || session.adminUser.status !== "enabled") {
      throw new AppError("unauthorized", "Admin session is required");
    }

    return {
      adminRole: session.adminUser.role,
      adminUserId: session.adminUser.id,
      displayName: session.adminUser.displayName,
      loginName: session.adminUser.loginName,
      permissionKeys: await this.adminRepository.permissionsForRole(session.adminUser.role),
    };
  }

  assertPermission(admin: CurrentAdmin, permissionKey: string): void {
    if (!admin.permissionKeys.includes(permissionKey)) {
      throw new AppError("forbidden", "Admin permission required", { permissionKey });
    }
  }

  async listAccounts(admin: CurrentAdmin, query: AdminUserListQuery): Promise<AdminUserRow[]> {
    this.assertPermission(admin, "admin.accounts.read");
    return this.adminRepository.listUsers(query);
  }

  async createAccount(admin: CurrentAdmin, input: { loginName: string; displayName: string; role: "super_admin"; reason?: string | undefined }) {
    this.assertPermission(admin, "admin.accounts.write");
    const existing = await this.adminRepository.findByLoginName(input.loginName);
    if (existing) {
      throw new AppError("conflict", "Admin login name already exists");
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const user = await this.adminRepository.createUser({
      loginName: input.loginName,
      passwordHash: this.hashPassword(temporaryPassword),
      displayName: input.displayName,
      role: input.role,
      createdByAdminId: admin.adminUserId,
    });
    await this.audit(admin, "admin.accounts.write", "admin_account_create", "admin_account", EntityIdCodec.stringify(user.id), undefined, this.sanitizeUser(user), input.reason);
    return { user, temporaryPassword };
  }

  async updateAccount(
    admin: CurrentAdmin,
    id: EntityId,
    input: { displayName?: string | undefined; status?: "enabled" | "disabled" | undefined; reason?: string | undefined },
  ): Promise<AdminUserRow> {
    this.assertPermission(admin, "admin.accounts.write");
    const target = await this.adminRepository.findUserById(id);
    if (!target) {
      throw new AppError("not_found", "Admin account not found");
    }
    if (target.id === admin.adminUserId && input.status === "disabled") {
      throw new AppError("validation_failed", "Current admin cannot disable own account");
    }
    if (target.role === "super_admin" && target.status === "enabled" && input.status === "disabled") {
      const enabledSuperAdmins = await this.adminRepository.enabledSuperAdminCount();
      if (enabledSuperAdmins <= 1) {
        throw new AppError("validation_failed", "Cannot disable the last enabled super admin");
      }
    }

    const patch: Parameters<AdminRepository["updateUser"]>[1] = { updatedByAdminId: admin.adminUserId };
    if (input.displayName !== undefined) {
      patch.displayName = input.displayName;
    }
    if (input.status !== undefined) {
      patch.status = input.status;
    }
    const result = await this.adminRepository.updateUser(id, patch);
    if (!result?.after) {
      throw new AppError("not_found", "Admin account not found");
    }
    const { before, after } = result;
    await this.audit(admin, "admin.accounts.write", "admin_account_update", "admin_account", EntityIdCodec.stringify(id), this.sanitizeUser(before), this.sanitizeUser(after), input.reason);
    return after;
  }

  async resetAccountPassword(admin: CurrentAdmin, id: EntityId, reason?: string): Promise<{ user: AdminUserRow; temporaryPassword: string }> {
    this.assertPermission(admin, "admin.accounts.write");
    const temporaryPassword = this.generateTemporaryPassword();
    const result = await this.adminRepository.updateUser(id, {
      passwordHash: this.hashPassword(temporaryPassword),
      updatedByAdminId: admin.adminUserId,
    });
    if (!result?.after) {
      throw new AppError("not_found", "Admin account not found");
    }
    const { before, after } = result;
    await this.audit(admin, "admin.accounts.write", "admin_account_reset_password", "admin_account", EntityIdCodec.stringify(id), this.sanitizeUser(before), this.sanitizeUser(after), reason);
    return { user: after, temporaryPassword };
  }

  async listAuditLogs(admin: CurrentAdmin, query: AdminAuditLogListQuery) {
    this.assertPermission(admin, "admin.audit.read");
    return this.adminRepository.listAuditLogs(query);
  }

  async audit(
    admin: CurrentAdmin,
    permissionKey: string,
    action: string,
    objectType: string,
    objectId?: string | null,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>,
    reason?: string | null,
  ): Promise<void> {
    const input: Parameters<AdminRepository["audit"]>[0] = {
      action,
      adminRole: admin.adminRole,
      adminUserId: admin.adminUserId,
      objectType,
      permissionKey,
    };
    if (objectId !== undefined) {
      input.objectId = objectId;
    }
    if (oldValue !== undefined) {
      input.oldValue = oldValue;
    }
    if (newValue !== undefined) {
      input.newValue = newValue;
    }
    if (reason !== undefined) {
      input.reason = reason;
    }
    await this.adminRepository.audit(input);
  }

  toPublicUser(user: AdminUserRow): Record<string, unknown> {
    return this.sanitizeUser(user) ?? {};
  }

  toPublicAuditLog(row: Awaited<ReturnType<AdminRepository["listAuditLogs"]>>[number]): Record<string, unknown> {
    return {
      adminUserId: row.adminUserId ? EntityIdCodec.stringify(row.adminUserId) : null,
      action: row.action,
      adminRole: row.adminRole,
      auditLogId: EntityIdCodec.stringify(row.id),
      createdAt: row.createdAt.toISOString(),
      newValue: row.newValue,
      objectId: row.objectId,
      objectType: row.objectType,
      oldValue: row.oldValue,
      permissionKey: row.permissionKey,
      reason: row.reason,
    };
  }

  hashPassword(password: string): string {
    return createHash("sha256").update(password).digest("hex");
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString("base64url");
  }

  private sanitizeUser(user: AdminUserRow | undefined): Record<string, unknown> | undefined {
    if (!user) {
      return undefined;
    }
    return {
      adminUserId: EntityIdCodec.stringify(user.id),
      createdAt: user.createdAt.toISOString(),
      createdByAdminId: user.createdByAdminId ? EntityIdCodec.stringify(user.createdByAdminId) : null,
      displayName: user.displayName,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      loginName: user.loginName,
      role: user.role,
      status: user.status,
      updatedAt: user.updatedAt.toISOString(),
      updatedByAdminId: user.updatedByAdminId ? EntityIdCodec.stringify(user.updatedByAdminId) : null,
    };
  }
}
