import type { SpeakingScoreResult } from "../domain/ScoreModels.js";

export interface ScoreSpeechInput {
  targetText: string;
  recordingUrl: string;
}

export interface SpeakingScoreProvider {
  score(input: ScoreSpeechInput): Promise<SpeakingScoreResult>;
}
