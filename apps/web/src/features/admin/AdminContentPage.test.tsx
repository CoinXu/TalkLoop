import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autoSyncContentUnit, importLearningUnit, publishContentUnit } from "../../api/adminApi";
import type { Session } from "../../types";
import { AdminContentPage } from "./AdminContentPage";

vi.mock("../../api/adminApi", () => ({
  autoSyncContentUnit: vi.fn().mockResolvedValue({ unitId: "3001" }),
  createContentUnit: vi.fn().mockResolvedValue({ unitId: "3001" }),
  importBbcContentUnit: vi.fn().mockResolvedValue({ jobId: "7001", unitId: "3001" }),
  importLearningUnit: vi.fn().mockResolvedValue({
    audioDurationSeconds: 180,
    audioUrl: "https://example.com/audio.mp3",
    dryRun: true,
    expression: "on the same page",
    expressionMeaning: "意见一致",
    localFiles: {
      audioPath: "/tmp/audio.mp3",
      manifestPath: "/tmp/manifest.json",
      pdfPath: "/tmp/file.pdf",
    },
    title: "Same page",
    transcriptSegmentCount: 2,
  }),
  publishContentUnit: vi.fn().mockResolvedValue({}),
}));

const session: Session = {
  expiresAt: "2026-05-03T00:00:00.000Z",
  isInternalTester: true,
  sessionId: "session-1",
  userId: "user-1",
};

describe("AdminContentPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(autoSyncContentUnit).mockClear();
    vi.mocked(importLearningUnit).mockClear();
    vi.mocked(publishContentUnit).mockClear();
  });

  it("runs draft sync and publish operations by unit id", async () => {
    render(
      <AdminContentPage
        session={session}
        section="operations"
        onBack={vi.fn()}
        onLoginRequired={vi.fn()}
        onSectionChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("学习单元 ID"), { target: { value: "3001" } });
    fireEvent.click(screen.getByRole("button", { name: "自动同步" }));
    fireEvent.click(screen.getByRole("button", { name: "发布" }));

    await waitFor(() => {
      expect(autoSyncContentUnit).toHaveBeenCalledWith("3001");
      expect(publishContentUnit).toHaveBeenCalledWith("3001");
    });
  });

  it("previews audio and PDF import as a dry run", async () => {
    render(
      <AdminContentPage
        session={session}
        section="import"
        onBack={vi.fn()}
        onLoginRequired={vi.fn()}
        onSectionChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("音频地址"), { target: { value: "https://example.com/audio.mp3" } });
    fireEvent.change(screen.getByLabelText("PDF 地址"), { target: { value: "https://example.com/file.pdf" } });
    fireEvent.click(screen.getByRole("button", { name: "预览解析" }));

    await waitFor(() => {
      expect(importLearningUnit).toHaveBeenCalledWith({
        audioUrl: "https://example.com/audio.mp3",
        dryRun: true,
        pdfUrl: "https://example.com/file.pdf",
        uploadedBy: "user-1",
      });
    });
  });
});
