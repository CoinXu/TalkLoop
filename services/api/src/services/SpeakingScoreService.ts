import { AppError } from "../domain/AppError.js";
import type { SubmitScoreInput } from "../domain/ScoreModels.js";
import type { ObjectStorageProvider } from "../providers/ObjectStorageProvider.js";
import type { SpeakingScoreProvider } from "../providers/SpeakingScoreProvider.js";
import type { ContentRepository } from "../repositories/ContentRepository.js";
import type { ScoreRepository } from "../repositories/ScoreRepository.js";
import type { UserRepository } from "../repositories/UserRepository.js";

export class SpeakingScoreService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly userRepository: UserRepository,
    private readonly scoreRepository: ScoreRepository,
    private readonly objectStorageProvider: ObjectStorageProvider,
    private readonly speakingScoreProvider: SpeakingScoreProvider,
  ) {}

  async submit(input: SubmitScoreInput) {
    if (input.recordingBuffer.byteLength === 0) {
      throw new AppError("validation_failed", "Recording is required");
    }

    const detail = await this.contentRepository.getUnitDetail(input.unitId);
    if (!detail) {
      throw new AppError("not_found", "Content unit not found");
    }
    this.assertScoreTargetExists(input, detail);

    const recordingUrl = await this.objectStorageProvider.storeRecording({
      userId: input.userId,
      unitId: input.unitId,
      mimeType: input.recordingMimeType,
      buffer: input.recordingBuffer,
    });
    const result = await this.speakingScoreProvider.score({
      targetText: input.targetText,
      recordingUrl,
      recordingBuffer: input.recordingBuffer,
      recordingMimeType: input.recordingMimeType,
    });

    const record = await this.scoreRepository.create({
      userId: input.userId,
      unitId: input.unitId,
      scoreTargetType: input.scoreTargetType,
      targetId: input.targetId,
      targetText: input.targetText,
      recordingUrl,
      ...result,
      providerPayload: { provider: this.speakingScoreProvider.providerName },
    });

    if (input.scoreTargetType === "speaking_prompt") {
      await this.userRepository.upsertProgress({
        userId: input.userId,
        unitId: input.unitId,
        currentStep: "score_result",
        status: "completed",
      });
    }

    return record;
  }

  private assertScoreTargetExists(input: SubmitScoreInput, detail: NonNullable<Awaited<ReturnType<ContentRepository["getUnitDetail"]>>>): void {
    if (input.scoreTargetType === "target_sentence") {
      const exists = detail.targets.some((target) => target.id === input.targetId);
      if (!exists) {
        throw new AppError("validation_failed", "Target sentence does not belong to this unit");
      }
      return;
    }

    const exists = detail.prompts.some((prompt) => prompt.id === input.targetId);
    if (!exists) {
      throw new AppError("validation_failed", "Speaking prompt does not belong to this unit");
    }
  }
}
