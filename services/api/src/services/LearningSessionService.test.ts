import { describe, expect, it } from "vitest";
import { AppError } from "../domain/AppError.js";
import { LearningSessionService } from "./LearningSessionService.js";

function unitDetail(licenseStatus: "approved" | "internal_review" | "unknown") {
  return {
    unit: {
      id: 3001n,
      licenseStatus,
      publishStatus: "published",
      syncStatus: "auto_synced",
    },
    audio: undefined,
    segments: [],
    targets: [],
    prompts: [],
    synced: [],
  };
}

describe("LearningSessionService", () => {
  it("allows internal testers to access internal review units", async () => {
    const service = new LearningSessionService(
      {
        async getUnitDetail() {
          return unitDetail("internal_review");
        },
      } as never,
      {
        async findProgress() {
          return undefined;
        },
      } as never,
    );

    const result = await service.getLearningUnit(3001n, { userId: 1001n, isInternalTester: true });

    expect(result.unit.licenseStatus).toBe("internal_review");
  });

  it("blocks ordinary users from internal review units", async () => {
    const service = new LearningSessionService(
      {
        async getUnitDetail() {
          return unitDetail("internal_review");
        },
      } as never,
      {} as never,
    );

    await expect(service.getLearningUnit(3001n, { userId: 1001n, isInternalTester: false })).rejects.toBeInstanceOf(AppError);
  });

  it("marks unit completed only through explicit speaking prompt completion path", async () => {
    const service = new LearningSessionService(
      {} as never,
      {
        async upsertProgress(input: unknown) {
          return input;
        },
      } as never,
    );

    const progress = await service.markCompletedBySpeakingPromptScore(1001n, 3001n);

    expect(progress).toMatchObject({
      currentStep: "score_result",
      status: "completed",
    });
  });
});
