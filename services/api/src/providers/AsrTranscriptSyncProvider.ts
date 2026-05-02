import type { EntityId } from "../domain/EntityId.js";
import type { TranscriptSegmentInput } from "../domain/ContentModels.js";
import type { RecognizedSpeechSegment, SpeechRecognitionProvider } from "./speech/SpeechRecognitionProvider.js";
import type { SyncedSegmentDraft, TranscriptSyncProvider } from "./TranscriptSyncProvider.js";

interface CandidateWindow {
  startIndex: number;
  endIndex: number;
  score: number;
}

const MIN_SEGMENT_MS = 250;
const LOW_CONFIDENCE_SCORE = 0.25;

interface AlignedSegment {
  segmentId: EntityId;
  startMs: number;
  endMs: number;
  englishText: string;
  chineseText?: string;
  confidence: number;
}

export class AsrTranscriptSyncProvider implements TranscriptSyncProvider {
  constructor(private readonly speechRecognitionProvider: SpeechRecognitionProvider) {}

  async autoSync(
    segments: Array<TranscriptSegmentInput & { segmentId: EntityId }>,
    audio: { url: string; durationSeconds: number },
  ): Promise<SyncedSegmentDraft[]> {
    const recognized = await this.speechRecognitionProvider.transcribe({ audioUrl: audio.url, language: "en" });
    if (recognized.length === 0) {
      return [];
    }

    let searchStart = 0;
    const aligned = segments.map((segment, index) => {
      const window = findBestWindow(segment.englishText, recognized, searchStart);
      searchStart = Math.max(window.endIndex, window.startIndex + 1);

      const startMs = recognized[window.startIndex]?.startMs ?? estimateStartMs(index, segments.length, audio.durationSeconds);
      const endMs =
        recognized[Math.max(window.endIndex - 1, window.startIndex)]?.endMs ?? estimateEndMs(index, segments.length, audio.durationSeconds);

      const syncedSegment: AlignedSegment = {
        segmentId: segment.segmentId,
        startMs,
        endMs: Math.max(endMs, startMs + MIN_SEGMENT_MS),
        englishText: segment.englishText,
        confidence: containsCjk(segment.englishText) ? 0 : window.score,
      };
      if (segment.chineseText !== undefined) {
        syncedSegment.chineseText = segment.chineseText;
      }
      return syncedSegment;
    });

    return smoothLowConfidenceSegments(aligned).map(({ confidence: _confidence, ...segment }) => segment);
  }
}

function smoothLowConfidenceSegments(segments: AlignedSegment[]): AlignedSegment[] {
  return segments.map((segment, index) => {
    if (segment.confidence >= LOW_CONFIDENCE_SCORE) {
      return segment;
    }

    const previous = findPreviousConfidentSegment(segments, index);
    const next = findNextConfidentSegment(segments, index);
    const startMs = previous?.endMs ?? segment.startMs;
    const endMs = next?.startMs ?? segment.endMs;
    if (endMs <= startMs) {
      return segment;
    }

    return {
      ...segment,
      startMs,
      endMs: Math.max(endMs, startMs + MIN_SEGMENT_MS),
    };
  });
}

function findPreviousConfidentSegment(segments: AlignedSegment[], index: number): AlignedSegment | undefined {
  for (let current = index - 1; current >= 0; current -= 1) {
    const segment = segments[current];
    if (segment && segment.confidence >= LOW_CONFIDENCE_SCORE) {
      return segment;
    }
  }
  return undefined;
}

function findNextConfidentSegment(segments: AlignedSegment[], index: number): AlignedSegment | undefined {
  for (let current = index + 1; current < segments.length; current += 1) {
    const segment = segments[current];
    if (segment && segment.confidence >= LOW_CONFIDENCE_SCORE) {
      return segment;
    }
  }
  return undefined;
}

function findBestWindow(targetText: string, recognized: RecognizedSpeechSegment[], searchStart: number): CandidateWindow {
  const targetTokens = tokenize(targetText);
  if (targetTokens.length === 0) {
    return { startIndex: Math.min(searchStart, recognized.length - 1), endIndex: Math.min(searchStart + 1, recognized.length), score: 0 };
  }

  const expectedTokenCount = targetTokens.length;
  const maxWindow = Math.max(1, Math.ceil(expectedTokenCount / 3) + 4);
  const maxStart = Math.max(searchStart, recognized.length - 1);
  let best: CandidateWindow | undefined;

  for (let startIndex = searchStart; startIndex <= maxStart && startIndex < recognized.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex <= recognized.length && endIndex <= startIndex + maxWindow; endIndex += 1) {
      const sourceTokens = tokenize(recognized.slice(startIndex, endIndex).map((segment) => segment.text).join(" "));
      const score = diceCoefficient(targetTokens, sourceTokens);
      if (!best || score > best.score) {
        best = { startIndex, endIndex, score };
      }
    }
  }

  return best ?? { startIndex: recognized.length - 1, endIndex: recognized.length, score: 0 };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

function containsCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function diceCoefficient(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightCounts = new Map<string, number>();
  for (const token of right) {
    rightCounts.set(token, (rightCounts.get(token) ?? 0) + 1);
  }

  let overlap = 0;
  for (const token of left) {
    const count = rightCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(token, count - 1);
    }
  }

  return (2 * overlap) / (left.length + right.length);
}

function estimateStartMs(index: number, totalSegments: number, durationSeconds: number): number {
  return Math.floor(((durationSeconds * 1000) / Math.max(totalSegments, 1)) * index);
}

function estimateEndMs(index: number, totalSegments: number, durationSeconds: number): number {
  return Math.floor(((durationSeconds * 1000) / Math.max(totalSegments, 1)) * (index + 1));
}
