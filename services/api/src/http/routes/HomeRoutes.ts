import type { FastifyInstance } from "fastify";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import { JsonPresenter } from "../JsonPresenter.js";
import { SessionResolver } from "../SessionResolver.js";
import { homeResponseSchema } from "../schemas/HomeSchemas.js";
import type { AccountService } from "../../services/AccountService.js";
import type { HomeService } from "../../services/HomeService.js";

@Tag("home")
export class HomeRoutes {
  private readonly sessionResolver: SessionResolver;

  constructor(
    private readonly homeService: HomeService,
    accountService: AccountService,
  ) {
    this.sessionResolver = new SessionResolver(accountService);
  }

  @Operation("Get home unit list and continue learning state", { security: [{ sessionId: [] }] })
  getHome(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.get(
      "/home",
      {
        schema: RouteDocs.schema(this, "getHome", {
          response: { 200: homeResponseSchema },
        }),
      },
      async (request) => {
        const user = await this.sessionResolver.optional(request.headers);
        return JsonPresenter.toJson(await this.homeService.getHome(user));
      },
    );
  }
}
