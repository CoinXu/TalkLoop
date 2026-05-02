import { AppError } from "../domain/AppError.js";
import type { SpeakingScoreResult } from "../domain/ScoreModels.js";
import type { ScoreSpeechInput, SpeakingScoreProvider } from "./SpeakingScoreProvider.js";

interface WhisperSegment {
  text?: unknown;
  startMs?: unknown;
  endMs?: unknown;
}

interface WhisperTranscriptionResponse {
  text?: unknown;
  durationSeconds?: unknown;
  segments?: unknown;
}

export class FasterWhisperSpeakingScoreProvider implements SpeakingScoreProvider {
  readonly providerName = "faster_whisper_text_similarity";

  constructor(private readonly baseUrl: string) {}

  async score(input: ScoreSpeechInput): Promise<SpeakingScoreResult> {
    const transcription = await this.transcribe(input);
    const recognizedText = typeof transcription.text === "string" ? transcription.text : "";
    if (!recognizedText.trim()) {
      return {
        overallScore: 0,
        pronunciationScore: 0,
        fluencyScore: 0,
        completenessScore: 0,
      };
    }

    const targetTokens = tokenize(input.targetText);
    const recognizedTokens = tokenize(recognizedText);
    const similarity = tokenSimilarity(targetTokens, recognizedTokens);
    const completeness = targetCompleteness(targetTokens, recognizedTokens);
    const fluency = estimateFluency(transcription);
    const pronunciation = Math.round(similarity * 100);
    const completenessScore = Math.round(completeness * 100);
    const overallScore = clampScore(Math.round(completenessScore * 0.55 + pronunciation * 0.35 + fluency * 0.1));

    return {
      overallScore,
      pronunciationScore: clampScore(pronunciation),
      fluencyScore: clampScore(fluency),
      completenessScore: clampScore(completenessScore),
    };
  }

  private async transcribe(input: ScoreSpeechInput): Promise<WhisperTranscriptionResponse> {
    const form = new FormData();
    const recordingBytes = new Uint8Array(input.recordingBuffer);
    form.set("file", new Blob([recordingBytes], { type: input.recordingMimeType }), fileNameFromMimeType(input.recordingMimeType));
    form.set("language", "en");
    form.set("response_format", "json");

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1/audio/transcriptions`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      throw new AppError("upstream_failed", `Whisper speaking transcription failed with ${response.status}`);
    }

    return (await response.json()) as WhisperTranscriptionResponse;
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

function tokenSimilarity(targetTokens: string[], recognizedTokens: string[]): number {
  if (targetTokens.length === 0 || recognizedTokens.length === 0) {
    return 0;
  }

  const distance = levenshteinDistance(targetTokens, recognizedTokens);
  return Math.max(0, 1 - distance / Math.max(targetTokens.length, recognizedTokens.length));
}

function targetCompleteness(targetTokens: string[], recognizedTokens: string[]): number {
  if (targetTokens.length === 0 || recognizedTokens.length === 0) {
    return 0;
  }

  const recognizedCounts = new Map<string, number>();
  for (const token of recognizedTokens) {
    recognizedCounts.set(token, (recognizedCounts.get(token) ?? 0) + 1);
  }

  let matched = 0;
  for (const token of targetTokens) {
    const count = recognizedCounts.get(token) ?? 0;
    if (count > 0) {
      matched += 1;
      recognizedCounts.set(token, count - 1);
    }
  }

  return matched / targetTokens.length;
}

function levenshteinDistance(left: string[], right: string[]): number {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (previous[rightIndex] ?? 0) + 1,
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost,
      );
    }
    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index] ?? previous[index] ?? 0;
    }
  }

  return previous[right.length] ?? 0;
}

function estimateFluency(transcription: WhisperTranscriptionResponse): number {
  if (!Array.isArray(transcription.segments)) {
    return 50;
  }

  const segments = transcription.segments as WhisperSegment[];
  const speechDurationMs = segments.reduce((total, segment) => {
    return typeof segment.startMs === "number" && typeof segment.endMs === "number"
      ? total + Math.max(0, segment.endMs - segment.startMs)
      : total;
  }, 0);

  const durationMs = typeof transcription.durationSeconds === "number" ? Math.max(1, transcription.durationSeconds * 1000) : speechDurationMs;
  if (speechDurationMs <= 0 || durationMs <= 0) {
    return 0;
  }

  const speechRatio = Math.min(1, speechDurationMs / durationMs);
  return clampScore(Math.round(45 + speechRatio * 55));
}

function fileNameFromMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) {
    return "recording.webm";
  }
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "recording.mp3";
  }
  return "recording.wav";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
