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

  it("rejects registration when the account already exists", async () => {
    const service = new AccountService(
      {
        async findUserByDestination() {
          return {
            id: 1001n,
            loginDestination: "learner@example.com",
            isInternalTester: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      } as never,
      "email_otp",
    );

    await expect(service.register({ destination: "learner@example.com", otpCode: "123456" })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("returns the current authenticated user from a valid session", async () => {
    const expiresAt = new Date(Date.now() + 1000);
    const service = new AccountService(
      {
        async findSession() {
          return {
            sessionId: 2001n,
            userId: 1001n,
            isInternalTester: true,
            expiresAt,
          };
        },
      } as never,
      "email_otp",
    );

    const user = await service.getCurrentUser(2001n);

    expect(user).toEqual({
      sessionId: "2001",
      userId: "1001",
      isInternalTester: true,
      expiresAt,
    });
  });

  it("deletes the session on logout", async () => {
    let deletedSessionId: bigint | undefined;
    const service = new AccountService(
      {
        async deleteSession(sessionId: bigint) {
          deletedSessionId = sessionId;
        },
      } as never,
      "email_otp",
    );

    await service.logout(2001n);

    expect(deletedSessionId).toBe(2001n);
  });
});
