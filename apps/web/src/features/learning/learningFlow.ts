import type { LearningStep, ProgressStatus, ScoreRecord } from "../../types";

export const learningSteps: LearningStep[] = [
  "listen_original",
  "intensive_listening",
  "target_shadowing",
  "speaking_prompt",
  "score_result",
];

export function getNextStep(currentStep: LearningStep): LearningStep {
  const index = learningSteps.indexOf(currentStep);
  return learningSteps[Math.min(index + 1, learningSteps.length - 1)] ?? "score_result";
}

export function getPreviousStep(currentStep: LearningStep): LearningStep {
  const index = learningSteps.indexOf(currentStep);
  return learningSteps[Math.max(index - 1, 0)] ?? "listen_original";
}

export function getProgressStatus(step: LearningStep, hasPromptScore: boolean): ProgressStatus {
  if (hasPromptScore && step === "score_result") {
    return "completed";
  }
  return step === "listen_original" ? "not_started" : "in_progress";
}

export function canCompleteUnit(score: ScoreRecord | null): boolean {
  return score?.scoreTargetType === "speaking_prompt";
}

export function getResumeStep(savedStep: LearningStep | undefined, status: ProgressStatus | undefined): LearningStep {
  if (status === "completed") {
    return "target_shadowing";
  }
  return savedStep ?? "listen_original";
}

export function isValidRecordingDuration(seconds: number): boolean {
  return seconds >= 1;
}

export function isRecordingTooLong(seconds: number, referenceSeconds?: number): boolean {
  return referenceSeconds !== undefined && seconds > referenceSeconds * 3;
}
