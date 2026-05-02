import { afterEach, describe, expect, it, vi } from "vitest";
import { FasterWhisperSpeakingScoreProvider } from "./FasterWhisperSpeakingScoreProvider.js";

describe("FasterWhisperSpeakingScoreProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scores matching recognized text higher than unrelated recognized text", async () => {
    const provider = new FasterWhisperSpeakingScoreProvider("http://whisper.local");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            text: "Think on your feet",
            durationSeconds: 2,
            segments: [{ startMs: 0, endMs: 1800, text: "Think on your feet" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            text: "I like coffee today",
            durationSeconds: 2,
            segments: [{ startMs: 0, endMs: 1800, text: "I like coffee today" }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const matching = await provider.score({
      targetText: "Think on your feet",
      recordingUrl: "http://storage.local/a.webm",
      recordingBuffer: Buffer.from("audio"),
      recordingMimeType: "audio/webm",
    });
    const unrelated = await provider.score({
      targetText: "Think on your feet",
      recordingUrl: "http://storage.local/b.webm",
      recordingBuffer: Buffer.from("audio"),
      recordingMimeType: "audio/webm",
    });

    expect(matching.overallScore).toBeGreaterThan(90);
    expect(unrelated.overallScore).toBeLessThan(50);
  });

  it("returns zero scores when Whisper recognizes no speech", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            text: "",
            durationSeconds: 2,
            segments: [],
          }),
          { status: 200 },
        ),
      ),
    );
    const provider = new FasterWhisperSpeakingScoreProvider("http://whisper.local");

    await expect(
      provider.score({
        targetText: "Think on your feet",
        recordingUrl: "http://storage.local/a.webm",
        recordingBuffer: Buffer.from("audio"),
        recordingMimeType: "audio/webm",
      }),
    ).resolves.toMatchObject({
      overallScore: 0,
      pronunciationScore: 0,
      fluencyScore: 0,
      completenessScore: 0,
    });
  });
});
