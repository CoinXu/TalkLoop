import type { FastifyInstance } from "fastify";
import { EntityIdCodec } from "../../domain/EntityId.js";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import { JsonPresenter } from "../JsonPresenter.js";
import { SessionResolver } from "../SessionResolver.js";
import { unitIdParamsSchema } from "../schemas/CommonSchemas.js";
import { learningUnitResponseSchema, progressResponseSchema, saveProgressRequestSchema } from "../schemas/LearningSchemas.js";
import type { AccountService } from "../../services/AccountService.js";
import type { LearningSessionService } from "../../services/LearningSessionService.js";

@Tag("learning")
export class LearningRoutes {
  private readonly sessionResolver: SessionResolver;

  constructor(
    private readonly learningSessionService: LearningSessionService,
    accountService: AccountService,
  ) {
    this.sessionResolver = new SessionResolver(accountService);
  }

  @Operation("Get a learning unit detail", { security: [{ sessionId: [] }] })
  getLearningUnit(): void {}

  @Operation("Save current learning progress", { security: [{ sessionId: [] }] })
  saveProgress(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.get(
      "/learning/units/:unitId",
      {
        schema: RouteDocs.schema(this, "getLearningUnit", {
          params: unitIdParamsSchema,
          response: { 200: learningUnitResponseSchema },
        }),
      },
      async (request) => {
        const { unitId } = unitIdParamsSchema.parse(request.params);
        const user = await this.sessionResolver.optional(request.headers);
        return JsonPresenter.toJson(await this.learningSessionService.getLearningUnit(EntityIdCodec.parse(unitId), user));
      },
    );

    app.put(
      "/learning/units/:unitId/progress",
      {
        schema: RouteDocs.schema(this, "saveProgress", {
          params: unitIdParamsSchema,
          body: saveProgressRequestSchema,
          response: { 200: progressResponseSchema },
        }),
      },
      async (request) => {
        const { unitId } = unitIdParamsSchema.parse(request.params);
        const user = await this.sessionResolver.required(request.headers);
        const input = saveProgressRequestSchema.parse(request.body);
        return JsonPresenter.toJson(
          await this.learningSessionService.saveProgress({
            userId: user.userId,
            unitId: EntityIdCodec.parse(unitId),
            currentStep: input.currentStep,
            status: input.status,
          }),
        );
      },
    );
  }
}
