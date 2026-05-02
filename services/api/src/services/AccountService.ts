import { AppError } from "../domain/AppError.js";
import type { LoginInput, RequestOtpInput } from "../domain/AccountModels.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { UserRepository } from "../repositories/UserRepository.js";

export class AccountService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly loginMethod: "email_otp" | "phone_otp",
  ) {}

  async requestOtp(input: RequestOtpInput) {
    this.assertDestinationMatchesLoginMethod(input.destination);
    return {
      destination: input.destination,
      deliveryChannel: this.loginMethod === "email_otp" ? "email" : "phone",
      expiresInSeconds: 300,
    };
  }

  async register(input: LoginInput) {
    this.assertDestinationMatchesLoginMethod(input.destination);
    this.assertOtpCode(input.otpCode);

    const existing = await this.userRepository.findUserByDestination(input.destination);
    if (existing) {
      throw new AppError("validation_failed", "Account already exists");
    }

    return this.createSessionForDestination(input.destination);
  }

  async login(input: LoginInput) {
    this.assertDestinationMatchesLoginMethod(input.destination);
    this.assertOtpCode(input.otpCode);

    return this.createSessionForDestination(input.destination);
  }

  async getCurrentUser(sessionId: EntityId) {
    const session = await this.requireSession(sessionId);
    return {
      userId: EntityIdCodec.stringify(session.userId),
      sessionId: EntityIdCodec.stringify(session.sessionId),
      isInternalTester: session.isInternalTester,
      expiresAt: session.expiresAt,
    };
  }

  async logout(sessionId: EntityId): Promise<void> {
    await this.userRepository.deleteSession(sessionId);
  }

  async requireSession(sessionId: EntityId) {
    const session = await this.userRepository.findSession(sessionId);
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new AppError("unauthorized", "Session expired or not found");
    }
    return session;
  }

  private async createSessionForDestination(destination: string) {
    const user = await this.userRepository.findOrCreateUser(destination);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const session = await this.userRepository.createSession(user.id, expiresAt);

    return {
      sessionId: EntityIdCodec.stringify(session.id),
      userId: EntityIdCodec.stringify(user.id),
      isInternalTester: user.isInternalTester,
      expiresAt,
    };
  }

  private assertDestinationMatchesLoginMethod(destination: string): void {
    if (this.loginMethod === "email_otp" && !destination.includes("@")) {
      throw new AppError("validation_failed", "Email login is required in this deployment");
    }
    if (this.loginMethod === "phone_otp" && !/^\+?[0-9]{6,20}$/.test(destination)) {
      throw new AppError("validation_failed", "Phone login is required in this deployment");
    }
  }

  private assertOtpCode(otpCode: string): void {
    if (otpCode.length < 4) {
      throw new AppError("validation_failed", "Invalid OTP code");
    }
  }
}
