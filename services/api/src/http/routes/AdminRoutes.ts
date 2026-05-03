import type { FastifyInstance, FastifyRequest } from "fastify";
import { EntityIdCodec, type EntityId } from "../../domain/EntityId.js";
import { AppError } from "../../domain/AppError.js";
import type { AdminService, CurrentAdmin } from "../../services/AdminService.js";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import {
  adminAccountParamsSchema,
  adminAccountListQuerySchema,
  adminAccountListResponseSchema,
  adminAuthResponseSchema,
  adminAuditLogListQuerySchema,
  adminAuditLogListResponseSchema,
  adminLoginRequestSchema,
  adminMeResponseSchema,
  adminUserResponseSchema,
  createAdminAccountRequestSchema,
  createAdminAccountResponseSchema,
  resetAdminPasswordRequestSchema,
  resetAdminPasswordResponseSchema,
  updateAdminAccountRequestSchema,
} from "../schemas/AdminSchemas.js";
import { emptyResponseSchema } from "../schemas/CommonSchemas.js";

@Tag("admin")
export class AdminRoutes {
  constructor(private readonly adminService: AdminService) {}

  @Operation("Admin login")
  login(): void {}

  @Operation("Admin logout")
  logout(): void {}

  @Operation("Get current admin")
  me(): void {}

  @Operation("List admin accounts")
  listAccounts(): void {}

  @Operation("Create admin account")
  createAccount(): void {}

  @Operation("Update admin account")
  updateAccount(): void {}

  @Operation("Reset admin account password")
  resetPassword(): void {}

  @Operation("List admin audit logs")
  listAuditLogs(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.post(
      "/admin/auth/login",
      { schema: RouteDocs.schema(this, "login", { body: adminLoginRequestSchema, response: { 200: adminAuthResponseSchema } }) },
      async (request) => {
        const body = adminLoginRequestSchema.parse(request.body);
        const result = await this.adminService.login(body.loginName, body.password);
        return {
          ...this.currentAdminToJson(result),
          adminSessionId: EntityIdCodec.stringify(result.adminSessionId),
          expiresAt: result.expiresAt.toISOString(),
        };
      },
    );

    app.post(
      "/admin/auth/logout",
      { schema: RouteDocs.schema(this, "logout", { response: { 200: emptyResponseSchema } }) },
      async (request) => {
        await this.adminService.logout(this.readSessionId(request));
        return null;
      },
    );

    app.get(
      "/admin/auth/me",
      { schema: RouteDocs.schema(this, "me", { response: { 200: adminMeResponseSchema } }) },
      async (request) => this.currentAdminToJson(await this.currentAdmin(request)),
    );

    app.get(
      "/admin/accounts",
      { schema: RouteDocs.schema(this, "listAccounts", { query: adminAccountListQuerySchema, response: { 200: adminAccountListResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const query = adminAccountListQuerySchema.parse(request.query);
        return { items: (await this.adminService.listAccounts(admin, query)).map((user) => this.adminService.toPublicUser(user)) };
      },
    );

    app.post(
      "/admin/accounts",
      { schema: RouteDocs.schema(this, "createAccount", { body: createAdminAccountRequestSchema, response: { 201: createAdminAccountResponseSchema } }) },
      async (request, reply) => {
        const admin = await this.currentAdmin(request);
        const body = createAdminAccountRequestSchema.parse(request.body);
        const result = await this.adminService.createAccount(admin, body);
        return reply.status(201).send({
          temporaryPassword: result.temporaryPassword,
          user: this.adminService.toPublicUser(result.user),
        });
      },
    );

    app.patch(
      "/admin/accounts/:id",
      { schema: RouteDocs.schema(this, "updateAccount", { params: adminAccountParamsSchema, body: updateAdminAccountRequestSchema, response: { 200: adminUserResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const { id } = adminAccountParamsSchema.parse(request.params);
        const body = updateAdminAccountRequestSchema.parse(request.body);
        return this.adminService.toPublicUser(await this.adminService.updateAccount(admin, EntityIdCodec.parse(id), body));
      },
    );

    app.post(
      "/admin/accounts/:id/reset-password",
      { schema: RouteDocs.schema(this, "resetPassword", { params: adminAccountParamsSchema, body: resetAdminPasswordRequestSchema, response: { 200: resetAdminPasswordResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const { id } = adminAccountParamsSchema.parse(request.params);
        const body = resetAdminPasswordRequestSchema.parse(request.body);
        const result = await this.adminService.resetAccountPassword(admin, EntityIdCodec.parse(id), body.reason);
        return {
          temporaryPassword: result.temporaryPassword,
          user: this.adminService.toPublicUser(result.user),
        };
      },
    );

    app.get(
      "/admin/audit-logs",
      { schema: RouteDocs.schema(this, "listAuditLogs", { query: adminAuditLogListQuerySchema, response: { 200: adminAuditLogListResponseSchema } }) },
      async (request) => {
        const admin = await this.currentAdmin(request);
        const query = adminAuditLogListQuerySchema.parse(request.query);
        return { items: (await this.adminService.listAuditLogs(admin, { ...query, adminUserId: query.adminUserId ? EntityIdCodec.parse(query.adminUserId) : undefined })).map((row) => this.adminService.toPublicAuditLog(row)) };
      },
    );
  }

  private async currentAdmin(request: FastifyRequest): Promise<CurrentAdmin> {
    return this.adminService.requireSession(this.readSessionId(request));
  }

  private readSessionId(request: FastifyRequest): EntityId {
    const value = request.headers["x-admin-session-id"];
    const sessionId = Array.isArray(value) ? value[0] : value;
    if (!sessionId) {
      throw new AppError("unauthorized", "Admin session is required");
    }
    return EntityIdCodec.parse(sessionId);
  }

  private currentAdminToJson(admin: CurrentAdmin): Record<string, unknown> {
    return {
      adminRole: admin.adminRole,
      adminUserId: EntityIdCodec.stringify(admin.adminUserId),
      displayName: admin.displayName,
      loginName: admin.loginName,
      permissionKeys: admin.permissionKeys,
    };
  }
}
