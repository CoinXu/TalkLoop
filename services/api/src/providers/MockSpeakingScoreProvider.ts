import type { SpeakingScoreResult } from "../domain/ScoreModels.js";
import type { ScoreSpeechInput, SpeakingScoreProvider } from "./SpeakingScoreProvider.js";

export class MockSpeakingScoreProvider implements SpeakingScoreProvider {
  async score(input: ScoreSpeechInput): Promise<SpeakingScoreResult> {
    const baseScore = Math.min(95, Math.max(60, input.targetText.length + 55));
    return {
      overallScore: baseScore,
      pronunciationScore: baseScore,
      fluencyScore: Math.max(0, baseScore - 4),
      completenessScore: Math.min(100, baseScore + 3),
    };
  }
}
