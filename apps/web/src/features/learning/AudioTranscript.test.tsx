import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AudioTranscript } from "../../components/business/AudioTranscript";

describe("AudioTranscript", () => {
  afterEach(() => cleanup());

  it("hides transcript in listen-only mode", () => {
    render(
      <AudioTranscript
        audioUrl="https://example.com/a.mp3"
        showTranscript={false}
        synced={[]}
        segments={[{ segmentId: "1", englishText: "We are on the same page.", chineseText: "我们意见一致。" }]}
      />,
    );

    expect(screen.queryByTestId("segment-1")).not.toBeInTheDocument();
  });

  it("renders a custom player with transcript lines", () => {
    render(
      <AudioTranscript
        audioUrl="https://example.com/a.mp3"
        showTranscript
        synced={[{ segmentId: "1", englishText: "We are on the same page.", chineseText: "我们意见一致。", startTimeSeconds: 0, endTimeSeconds: 3 }]}
        segments={[]}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Play|播放/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("slider", { name: /Seek|拖动播放进度/ }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("segment-1")).toBeInTheDocument();
  });

  it("syncs transcript with API startMs and endMs fields", () => {
    const { container } = render(
      <AudioTranscript
        audioUrl="https://example.com/a.mp3"
        showTranscript
        synced={[
          { id: "101", transcriptSegmentId: "1", englishText: "First line.", chineseText: "第一句。", startMs: 0, endMs: 1000 },
          { id: "102", transcriptSegmentId: "2", englishText: "Second line.", chineseText: "第二句。", startMs: 1001, endMs: 2500 },
        ]}
        segments={[]}
      />,
    );

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    Object.defineProperty(audio, "currentTime", { configurable: true, value: 1.5 });
    fireEvent.timeUpdate(audio as HTMLAudioElement);

    expect(screen.getByTestId("current-segment-text")).toHaveTextContent("Second line.");
    expect(screen.getByTestId("segment-2")).toBeInTheDocument();
  });
});
