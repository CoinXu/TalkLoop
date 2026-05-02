import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveProgress } from "../../api/learningApi";
import type { LearningUnitResponse, Session } from "../../types";
import { LearningPage } from "./LearningPage";

vi.mock("../../api/learningApi", () => ({
  saveProgress: vi.fn().mockResolvedValue({}),
  submitScore: vi.fn(),
}));

const session: Session = {
  expiresAt: "2026-05-03T00:00:00.000Z",
  isInternalTester: false,
  sessionId: "session-1",
  userId: "user-1",
};

const unit: LearningUnitResponse = {
  audio: null,
  prompts: [],
  progress: {
    currentStep: "intensive_listening",
    status: "in_progress",
  },
  segments: [{ id: "seg-1", englishText: "We are on the same page.", chineseText: "我们意见一致。" }],
  synced: [],
  targets: [],
  unit: {
    id: "3001",
    difficulty: "A2",
    estimatedMinutes: 5,
    expression: "on the same page",
    expressionMeaning: "意见一致",
    title: "Same page",
  },
};

describe("LearningPage", () => {
  beforeEach(() => {
    vi.mocked(saveProgress).mockClear();
  });

  it("resets a unit to the first step and saves not-started progress", async () => {
    render(
      <LearningPage
        error={null}
        loading={false}
        onBack={vi.fn()}
        onLoginRequired={vi.fn()}
        onReload={vi.fn()}
        session={session}
        unit={unit}
        unitId="3001"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "再来一次" }));

    await waitFor(() => {
      expect(saveProgress).toHaveBeenCalledWith("3001", "listen_original", "not_started");
    });
    expect(screen.queryByTestId("segment-seg-1")).not.toBeInTheDocument();
  });
});
