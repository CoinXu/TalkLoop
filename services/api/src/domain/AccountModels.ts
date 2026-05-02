import type { LearningStep, ProgressStatus } from "./Enums.js";
import type { EntityId } from "./EntityId.js";

export interface LoginInput {
  destination: string;
  otpCode: string;
}

export interface AuthSession {
  sessionId: EntityId;
  userId: EntityId;
  isInternalTester: boolean;
  expiresAt: Date;
}

export interface UnitProgressState {
  userId: EntityId;
  unitId: EntityId;
  currentStep: LearningStep;
  status: ProgressStatus;
  updatedAt: Date;
}
