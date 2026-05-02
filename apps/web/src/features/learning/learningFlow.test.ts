import { describe, expect, it } from "vitest";
import type { ScoreRecord } from "../../types";
import { canCompleteUnit, getNextStep, getProgressStatus, getResumeStep, isRecordingTooLong, isValidRecordingDuration } from "./learningFlow";

describe("learningFlow", () => {
  it("advances through the fixed PRD step order", () => {
    expect(getNextStep("listen_original")).toBe("intensive_listening");
    expect(getNextStep("speaking_prompt")).toBe("score_result");
    expect(getNextStep("score_result")).toBe("score_result");
  });

  it("only completes a unit after a speaking prompt score", () => {
    const targetSentenceScore = { scoreTargetType: "target_sentence" } as ScoreRecord;
    const promptScore = { scoreTargetType: "speaking_prompt" } as ScoreRecord;

    expect(canCompleteUnit(targetSentenceScore)).toBe(false);
    expect(canCompleteUnit(promptScore)).toBe(true);
    expect(getProgressStatus("score_result", true)).toBe("completed");
  });

  it("resumes completed units at practice instead of the beginning", () => {
    expect(getResumeStep("score_result", "completed")).toBe("target_shadowing");
    expect(getResumeStep("intensive_listening", "in_progress")).toBe("intensive_listening");
  });

  it("validates recording boundaries", () => {
    expect(isValidRecordingDuration(0.8)).toBe(false);
    expect(isValidRecordingDuration(1.1)).toBe(true);
    expect(isRecordingTooLong(16, 5)).toBe(true);
  });
});
