import { describe, expect, it } from "vitest";
import { AsrTranscriptSyncProvider } from "./AsrTranscriptSyncProvider.js";

describe("AsrTranscriptSyncProvider", () => {
  it("aligns PDF transcript segments to recognized speech timestamps", async () => {
    const provider = new AsrTranscriptSyncProvider({
      async transcribe() {
        return [
          { text: "Hello, I'm Feifei.", startMs: 1000, endMs: 2100 },
          { text: "And I'm Phil.", startMs: 2200, endMs: 3300 },
          { text: "Think on your feet means react quickly.", startMs: 4000, endMs: 7200 },
        ];
      },
    });

    const synced = await provider.autoSync(
      [
        {
          segmentId: 1n,
          englishText: "Hello, I'm Feifei.",
          segmentOrder: 0,
        },
        {
          segmentId: 2n,
          englishText: "Think on your feet means react quickly.",
          segmentOrder: 1,
        },
      ],
      { url: "http://127.0.0.1/audio.mp3", durationSeconds: 10 },
    );

    expect(synced).toMatchObject([
      { segmentId: 1n, startMs: 1000, endMs: 2100 },
      { segmentId: 2n, startMs: 4000, endMs: 7200 },
    ]);
  });
});
