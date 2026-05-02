import type { FastifyInstance } from "fastify";
import { AppError } from "../../domain/AppError.js";
import { EntityIdCodec } from "../../domain/EntityId.js";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import {
  currentUserResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  requestOtpRequestSchema,
  requestOtpResponseSchema,
} from "../schemas/AccountSchemas.js";
import type { AccountService } from "../../services/AccountService.js";

@Tag("auth")
export class AccountRoutes {
  constructor(private readonly accountService: AccountService) {}

  @Operation("Request an OTP code")
  requestOtp(): void {}

  @Operation("Register with OTP")
  registerAccount(): void {}

  @Operation("Login with OTP")
  login(): void {}

  @Operation("Get current authenticated user", { security: [{ sessionId: [] }] })
  me(): void {}

  @Operation("Logout current session", { security: [{ sessionId: [] }] })
  logout(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.post(
      "/auth/otp",
      {
        schema: RouteDocs.schema(this, "requestOtp", {
          body: requestOtpRequestSchema,
          response: { 200: requestOtpResponseSchema },
        }),
      },
      async (request) => {
        const input = requestOtpRequestSchema.parse(request.body);
        return this.accountService.requestOtp(input);
      },
    );

    app.post(
      "/auth/register",
      {
        schema: RouteDocs.schema(this, "registerAccount", {
          body: loginRequestSchema,
          response: { 201: loginResponseSchema },
        }),
      },
      async (request, reply) => {
        const input = loginRequestSchema.parse(request.body);
        const result = await this.accountService.register(input);
        return reply.status(201).send(result);
      },
    );

    app.post(
      "/auth/login",
      {
        schema: RouteDocs.schema(this, "login", {
          body: loginRequestSchema,
          response: { 200: loginResponseSchema },
        }),
      },
      async (request) => {
        const input = loginRequestSchema.parse(request.body);
        return this.accountService.login(input);
      },
    );

    app.get(
      "/auth/me",
      {
        schema: RouteDocs.schema(this, "me", {
          response: { 200: currentUserResponseSchema },
        }),
      },
      async (request) => this.accountService.getCurrentUser(this.readRequiredSessionId(request.headers)),
    );

    app.post(
      "/auth/logout",
      {
        schema: RouteDocs.schema(this, "logout", {}),
      },
      async (request, reply) => {
        await this.accountService.logout(this.readRequiredSessionId(request.headers));
        return reply.status(204).send();
      },
    );
  }

  private readRequiredSessionId(headers: { [key: string]: unknown }) {
    const value = headers["x-session-id"];
    const sessionId = Array.isArray(value) ? value[0] : value;
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      throw new AppError("unauthorized", "Session is required");
    }
    return EntityIdCodec.parse(sessionId);
  }
}
