import type {
  HomeResponse,
  LearningStep,
  LearningUnitResponse,
  ProgressStatus,
  ScoreRecord,
  Session,
  SubmitScoreInput,
} from "../types";
import { requestJson } from "./client";

export function login(destination: string, otpCode: string): Promise<Session> {
  return requestJson<Session>("/auth/login", {
    method: "POST",
    body: { destination, otpCode },
  });
}

export function getHome(): Promise<HomeResponse> {
  return requestJson<HomeResponse>("/home");
}

export function getLearningUnit(unitId: string): Promise<LearningUnitResponse> {
  return requestJson<LearningUnitResponse>(`/learning/units/${unitId}`);
}

export function saveProgress(unitId: string, currentStep: LearningStep, status: ProgressStatus): Promise<unknown> {
  return requestJson(`/learning/units/${unitId}/progress`, {
    method: "PUT",
    requireSession: true,
    body: { currentStep, status },
  });
}

export function submitScore(input: SubmitScoreInput): Promise<ScoreRecord> {
  return requestJson<ScoreRecord>("/speaking-scores", {
    method: "POST",
    requireSession: true,
    body: input,
  });
}
