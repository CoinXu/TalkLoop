import type { SpeakingScoreResult } from "../domain/ScoreModels.js";

export interface ScoreSpeechInput {
  targetText: string;
  recordingUrl: string;
  recordingBuffer: Buffer;
  recordingMimeType: string;
}

export interface SpeakingScoreProvider {
  readonly providerName: string;
  score(input: ScoreSpeechInput): Promise<SpeakingScoreResult>;
}
