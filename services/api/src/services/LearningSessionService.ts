import { AppError } from "../domain/AppError.js";
import type { LearningStep, ProgressStatus } from "../domain/Enums.js";
import type { EntityId } from "../domain/EntityId.js";
import type { ContentRepository } from "../repositories/ContentRepository.js";
import type { UserRepository } from "../repositories/UserRepository.js";
import { AssetUrlResolver } from "./AssetUrlResolver.js";

export class LearningSessionService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly userRepository: UserRepository,
    private readonly assetUrlResolver: AssetUrlResolver = new AssetUrlResolver(),
  ) {}

  async getLearningUnit(unitId: EntityId, user?: { userId: EntityId; isInternalTester: boolean }) {
    const detail = await this.contentRepository.getUnitDetail(unitId);
    if (!detail) {
      throw new AppError("not_found", "Content unit not found");
    }
    if (!this.canAccessUnit(detail.unit.licenseStatus, detail.unit.publishStatus, detail.unit.syncStatus, user?.isInternalTester ?? false)) {
      throw new AppError("forbidden", "Unit is not available for this user");
    }

    const progress = user ? await this.userRepository.findProgress(user.userId, unitId) : undefined;
    return {
      ...detail,
      audio: detail.audio ? { ...detail.audio, url: this.assetUrlResolver.toPublicUrl(detail.audio.url) } : detail.audio,
      progress,
    };
  }

  async saveProgress(input: { userId: EntityId; unitId: EntityId; currentStep: LearningStep; status: ProgressStatus }) {
    return this.userRepository.upsertProgress(input);
  }

  async markCompletedBySpeakingPromptScore(userId: EntityId, unitId: EntityId) {
    return this.userRepository.upsertProgress({
      userId,
      unitId,
      currentStep: "score_result",
      status: "completed",
    });
  }

  private canAccessUnit(
    licenseStatus: string,
    publishStatus: string,
    syncStatus: string,
    isInternalTester: boolean,
  ): boolean {
    if (publishStatus !== "published") {
      return false;
    }
    if (syncStatus !== "auto_synced" && syncStatus !== "manually_reviewed") {
      return false;
    }
    if (licenseStatus === "approved") {
      return true;
    }
    return licenseStatus === "internal_review" && isInternalTester;
  }
}
