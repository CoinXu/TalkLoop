import { AppError } from "../domain/AppError.js";
import type { LoginInput } from "../domain/AccountModels.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { UserRepository } from "../repositories/UserRepository.js";

export class AccountService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly loginMethod: "email_otp" | "phone_otp",
  ) {}

  async login(input: LoginInput) {
    this.assertDestinationMatchesLoginMethod(input.destination);
    if (input.otpCode.length < 4) {
      throw new AppError("validation_failed", "Invalid OTP code");
    }

    const user = await this.userRepository.findOrCreateUser(input.destination);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const session = await this.userRepository.createSession(user.id, expiresAt);

    return {
      sessionId: EntityIdCodec.stringify(session.id),
      userId: EntityIdCodec.stringify(user.id),
      isInternalTester: user.isInternalTester,
      expiresAt,
    };
  }

  async requireSession(sessionId: EntityId) {
    const session = await this.userRepository.findSession(sessionId);
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new AppError("unauthorized", "Session expired or not found");
    }
    return session;
  }

  private assertDestinationMatchesLoginMethod(destination: string): void {
    if (this.loginMethod === "email_otp" && !destination.includes("@")) {
      throw new AppError("validation_failed", "Email login is required in this deployment");
    }
    if (this.loginMethod === "phone_otp" && !/^\+?[0-9]{6,20}$/.test(destination)) {
      throw new AppError("validation_failed", "Phone login is required in this deployment");
    }
  }
}
