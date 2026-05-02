import { AppError } from "../domain/AppError.js";
import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { AccountService } from "../services/AccountService.js";

export interface CurrentUser {
  userId: EntityId;
  isInternalTester: boolean;
}

export class SessionResolver {
  constructor(private readonly accountService: AccountService) {}

  async optional(headers: { [key: string]: unknown }): Promise<CurrentUser | undefined> {
    const sessionId = this.readSessionHeader(headers);
    if (!sessionId) {
      return undefined;
    }
    const session = await this.accountService.requireSession(EntityIdCodec.parse(sessionId));
    return { userId: session.userId, isInternalTester: session.isInternalTester };
  }

  async required(headers: { [key: string]: unknown }): Promise<CurrentUser> {
    const sessionId = this.readSessionHeader(headers);
    if (!sessionId) {
      throw new AppError("unauthorized", "Session is required");
    }
    const session = await this.accountService.requireSession(EntityIdCodec.parse(sessionId));
    return { userId: session.userId, isInternalTester: session.isInternalTester };
  }

  private readSessionHeader(headers: { [key: string]: unknown }): string | undefined {
    const value = headers["x-session-id"];
    if (Array.isArray(value)) {
      return value[0];
    }
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }
}
