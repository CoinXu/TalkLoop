import { AppError } from "../../domain/AppError.js";
import type { RecognizedSpeechSegment, SpeechRecognitionProvider } from "./SpeechRecognitionProvider.js";

interface FasterWhisperSegmentResponse {
  text?: unknown;
  startMs?: unknown;
  endMs?: unknown;
}

interface FasterWhisperResponse {
  segments?: unknown;
}

export class FasterWhisperSpeechRecognitionProvider implements SpeechRecognitionProvider {
  constructor(private readonly baseUrl: string) {}

  async transcribe(input: { audioUrl: string; language?: string | undefined }): Promise<RecognizedSpeechSegment[]> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/transcribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audioUrl: input.audioUrl,
        language: input.language ?? "en",
        wordTimestamps: false,
      }),
    });

    if (!response.ok) {
      throw new AppError("upstream_failed", `Whisper transcription failed with ${response.status}`);
    }

    const payload = (await response.json()) as FasterWhisperResponse;
    if (!Array.isArray(payload.segments)) {
      throw new AppError("upstream_failed", "Whisper transcription response is missing segments");
    }

    return payload.segments.map((rawSegment, index) => {
      const segment = rawSegment as FasterWhisperSegmentResponse;
      if (typeof segment.text !== "string" || typeof segment.startMs !== "number" || typeof segment.endMs !== "number") {
        throw new AppError("upstream_failed", `Whisper transcription segment ${index} is invalid`);
      }
      return {
        text: segment.text,
        startMs: segment.startMs,
        endMs: segment.endMs,
      };
    });
  }
}
