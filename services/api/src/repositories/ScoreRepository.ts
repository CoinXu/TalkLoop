import { and, desc, eq } from "drizzle-orm";
import type { SpeakingScoreResult } from "../domain/ScoreModels.js";
import type { ScoreTargetType } from "../domain/Enums.js";
import type { EntityId } from "../domain/EntityId.js";
import type { AppDatabase } from "../infrastructure/database/Database.js";
import type { SnowflakeIdGenerator } from "../infrastructure/SnowflakeIdGenerator.js";
import { scoreRecords } from "../infrastructure/database/schema.js";

export interface CreateScoreRecordInput extends SpeakingScoreResult {
  userId: EntityId;
  unitId: EntityId;
  scoreTargetType: ScoreTargetType;
  targetId: EntityId;
  targetText: string;
  recordingUrl: string;
  providerPayload?: Record<string, unknown>;
}

export class ScoreRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly idGenerator: SnowflakeIdGenerator,
  ) {}

  async create(input: CreateScoreRecordInput) {
    const now = this.idGenerator.now();
    const [record] = await this.db
      .insert(scoreRecords)
      .values({
        id: this.idGenerator.nextId(),
        userId: input.userId,
        contentUnitId: input.unitId,
        scoreTargetType: input.scoreTargetType,
        targetId: input.targetId,
        targetText: input.targetText,
        overallScore: input.overallScore,
        pronunciationScore: input.pronunciationScore ?? null,
        fluencyScore: input.fluencyScore ?? null,
        completenessScore: input.completenessScore ?? null,
        recordingUrl: input.recordingUrl,
        providerPayload: input.providerPayload ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!record) {
      throw new Error("Failed to create score record");
    }
    return record;
  }

  async listByUnit(userId: EntityId, unitId: EntityId) {
    return this.db
      .select()
      .from(scoreRecords)
      .where(and(eq(scoreRecords.userId, userId), eq(scoreRecords.contentUnitId, unitId)))
      .orderBy(desc(scoreRecords.createdAt));
  }

  async findLatestByUnit(userId: EntityId, unitId: EntityId) {
    const [record] = await this.db
      .select()
      .from(scoreRecords)
      .where(and(eq(scoreRecords.userId, userId), eq(scoreRecords.contentUnitId, unitId)))
      .orderBy(desc(scoreRecords.createdAt))
      .limit(1);
    return record;
  }
}
