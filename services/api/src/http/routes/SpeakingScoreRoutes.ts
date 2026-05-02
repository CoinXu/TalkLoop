import type { FastifyInstance } from "fastify";
import { EntityIdCodec } from "../../domain/EntityId.js";
import { Operation, RouteDocs, Tag } from "../docs/RouteDecorators.js";
import { JsonPresenter } from "../JsonPresenter.js";
import { SessionResolver } from "../SessionResolver.js";
import { scoreRecordResponseSchema, submitScoreRequestSchema } from "../schemas/SpeakingScoreSchemas.js";
import type { AccountService } from "../../services/AccountService.js";
import type { SpeakingScoreService } from "../../services/SpeakingScoreService.js";

@Tag("speaking-score")
export class SpeakingScoreRoutes {
  private readonly sessionResolver: SessionResolver;

  constructor(
    private readonly speakingScoreService: SpeakingScoreService,
    accountService: AccountService,
  ) {
    this.sessionResolver = new SessionResolver(accountService);
  }

  @Operation("Submit a recording for speaking score", { security: [{ sessionId: [] }] })
  submitScore(): void {}

  async register(app: FastifyInstance): Promise<void> {
    app.post(
      "/speaking-scores",
      {
        schema: RouteDocs.schema(this, "submitScore", {
          body: submitScoreRequestSchema,
          response: { 201: scoreRecordResponseSchema },
        }),
      },
      async (request, reply) => {
        const user = await this.sessionResolver.required(request.headers);
        const input = submitScoreRequestSchema.parse(request.body);
        const result = await this.speakingScoreService.submit({
          userId: user.userId,
          unitId: EntityIdCodec.parse(input.unitId),
          scoreTargetType: input.scoreTargetType,
          targetId: EntityIdCodec.parse(input.targetId),
          targetText: input.targetText,
          recordingBuffer: Buffer.from(input.recordingBase64, "base64"),
          recordingMimeType: input.recordingMimeType,
        });
        return reply.status(201).send(JsonPresenter.toJson(result));
      },
    );
  }
}
