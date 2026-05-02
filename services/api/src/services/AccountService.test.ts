import { describe, expect, it } from "vitest";
import { AppError } from "../domain/AppError.js";
import { AccountService } from "./AccountService.js";

describe("AccountService", () => {
  it("creates a session for the configured email login method", async () => {
    const service = new AccountService(
      {
        async findOrCreateUser() {
          return {
            id: 1001n,
            loginDestination: "learner@example.com",
            isInternalTester: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
        async createSession() {
          return {
            id: 2001n,
            userId: 1001n,
            expiresAt: new Date(Date.now() + 1000),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      } as never,
      "email_otp",
    );

    const session = await service.login({ destination: "learner@example.com", otpCode: "123456" });

    expect(session.userId).toBe("1001");
    expect(session.sessionId).toBe("2001");
  });

  it("rejects phone values when deployment uses email otp", async () => {
    const service = new AccountService({} as never, "email_otp");

    await expect(service.login({ destination: "+8613800000000", otpCode: "123456" })).rejects.toBeInstanceOf(AppError);
  });
});
