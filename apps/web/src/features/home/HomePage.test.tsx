import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("shows continue learning only for logged-in users", () => {
    render(
      <HomePage
        home={{ continueLearning: { unitId: "1", title: "On the same page", currentStep: "speaking_prompt" }, units: [] }}
        session={{ sessionId: "s", userId: "u", isInternalTester: false, expiresAt: "2999-01-01T00:00:00.000Z" }}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onOpenAdmin={vi.fn()}
        onOpenUnit={vi.fn()}
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByTestId("continue-learning")).toBeInTheDocument();
    expect(screen.getByText("上次停在替换说")).toBeInTheDocument();
  });
});
