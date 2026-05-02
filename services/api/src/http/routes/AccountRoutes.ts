import type { FastifyInstance } from "fastify";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import { loginRequestSchema, loginResponseSchema } from "../schemas/AccountSchemas.js";
import type { AccountService } from "../../services/AccountService.js";

@Tag("auth")
export class AccountRoutes {
  constructor(private readonly accountService: AccountService) {}

  @Operation("Login with OTP")
  login(): void {}

  async register(app: FastifyInstance): Promise<void> {
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
  }
}
