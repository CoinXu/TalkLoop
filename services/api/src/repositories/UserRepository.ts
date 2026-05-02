import { and, desc, eq } from "drizzle-orm";
import type { LearningStep, ProgressStatus } from "../domain/Enums.js";
import type { EntityId } from "../domain/EntityId.js";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import { sessions, unitProgress, users } from "../infrastructure/database/schema.js";

export class UserRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly idGenerator: SnowflakeIdGenerator,
  ) {}

  async findOrCreateUser(loginDestination: string) {
    const [existing] = await this.db.select().from(users).where(eq(users.loginDestination, loginDestination)).limit(1);
    if (existing) {
      return existing;
    }

    const now = this.idGenerator.now();
    const [created] = await this.db
      .insert(users)
      .values({
        id: this.idGenerator.nextId(),
        loginDestination,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create user");
    }
    return created;
  }

  async findUserByDestination(loginDestination: string) {
    const [user] = await this.db.select().from(users).where(eq(users.loginDestination, loginDestination)).limit(1);
    return user;
  }

  async createSession(userId: EntityId, expiresAt: Date) {
    const now = this.idGenerator.now();
    const [session] = await this.db
      .insert(sessions)
      .values({
        id: this.idGenerator.nextId(),
        userId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!session) {
      throw new Error("Failed to create session");
    }
    return session;
  }

  async findSession(sessionId: EntityId) {
    const [session] = await this.db
      .select({
        sessionId: sessions.id,
        userId: users.id,
        isInternalTester: users.isInternalTester,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return session;
  }

  async deleteSession(sessionId: EntityId): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async upsertProgress(input: {
    userId: EntityId;
    unitId: EntityId;
    currentStep: LearningStep;
    status: ProgressStatus;
  }) {
    const now = this.idGenerator.now();
    const [progress] = await this.db
      .insert(unitProgress)
      .values({
        id: this.idGenerator.nextId(),
        userId: input.userId,
        contentUnitId: input.unitId,
        currentStep: input.currentStep,
        status: input.status,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [unitProgress.userId, unitProgress.contentUnitId],
        set: { currentStep: input.currentStep, status: input.status, updatedAt: now },
      })
      .returning();

    if (!progress) {
      throw new Error("Failed to upsert progress");
    }
    return progress;
  }

  async findProgress(userId: EntityId, unitId: EntityId) {
    const [progress] = await this.db
      .select()
      .from(unitProgress)
      .where(and(eq(unitProgress.userId, userId), eq(unitProgress.contentUnitId, unitId)))
      .limit(1);
    return progress;
  }

  async findLatestProgress(userId: EntityId) {
    const [progress] = await this.db
      .select()
      .from(unitProgress)
      .where(eq(unitProgress.userId, userId))
      .orderBy(desc(unitProgress.updatedAt))
      .limit(1);
    return progress;
  }
}
