import { describe, expect, it } from "vitest";
import { SpeakingScoreService } from "./SpeakingScoreService.js";

function createService(progressCalls: unknown[]) {
  return new SpeakingScoreService(
    {
      async getUnitDetail() {
        return {
          unit: { id: 3001n },
          audio: undefined,
          segments: [],
          targets: [{ id: 4001n }],
          prompts: [{ id: 5001n }],
          synced: [],
        };
      },
    } as never,
    {
      async upsertProgress(input: unknown) {
        progressCalls.push(input);
        return input;
      },
    } as never,
    {
      async create(input: Record<string, unknown>) {
        return { id: 9001n, ...input };
      },
    } as never,
    {
      async storeRecording() {
        return "http://storage.local/recording.webm";
      },
    } as never,
    {
      async score() {
        return {
          overallScore: 88,
          pronunciationScore: 87,
          fluencyScore: 86,
          completenessScore: 89,
        };
      },
    } as never,
  );
}

describe("SpeakingScoreService", () => {
  it("marks the unit completed after a valid speaking prompt score", async () => {
    const progressCalls: unknown[] = [];
    const service = createService(progressCalls);

    const record = await service.submit({
      userId: 1001n,
      unitId: 3001n,
      scoreTargetType: "speaking_prompt",
      targetId: 5001n,
      targetText: "I am on the same page.",
      recordingBuffer: Buffer.from("audio"),
      recordingMimeType: "audio/webm",
    });

    expect(record).toMatchObject({ overallScore: 88 });
    expect(progressCalls).toHaveLength(1);
    expect(progressCalls[0]).toMatchObject({ status: "completed", currentStep: "score_result" });
  });

  it("does not mark the unit completed for target sentence scores", async () => {
    const progressCalls: unknown[] = [];
    const service = createService(progressCalls);

    await service.submit({
      userId: 1001n,
      unitId: 3001n,
      scoreTargetType: "target_sentence",
      targetId: 4001n,
      targetText: "I am on the same page.",
      recordingBuffer: Buffer.from("audio"),
      recordingMimeType: "audio/webm",
    });

    expect(progressCalls).toHaveLength(0);
  });
});
