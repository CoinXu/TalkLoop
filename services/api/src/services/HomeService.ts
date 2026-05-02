import { EntityIdCodec, type EntityId } from "../domain/EntityId.js";
import type { ContentRepository } from "../repositories/ContentRepository.js";
import type { ScoreRepository } from "../repositories/ScoreRepository.js";
import type { UserRepository } from "../repositories/UserRepository.js";

export class HomeService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly userRepository: UserRepository,
    private readonly scoreRepository: ScoreRepository,
  ) {}

  async getHome(user?: { userId: EntityId; isInternalTester: boolean }) {
    const units = await this.contentRepository.listVisibleUnits(user?.isInternalTester ?? false);
    const continueLearning = user ? await this.userRepository.findLatestProgress(user.userId) : undefined;

    const unitCards = await Promise.all(
      units.map(async (unit) => {
        const progress = user ? await this.userRepository.findProgress(user.userId, unit.id) : undefined;
        const latestScore = user ? await this.scoreRepository.findLatestByUnit(user.userId, unit.id) : undefined;
        return {
          unitId: EntityIdCodec.stringify(unit.id),
          title: unit.title,
          expression: unit.expression,
          expressionMeaning: unit.expressionMeaning,
          estimatedMinutes: unit.estimatedMinutes,
          difficulty: unit.difficulty,
          completionStatus: progress?.status ?? "not_started",
          recentScore: latestScore?.overallScore,
          isInternalOnly: unit.licenseStatus === "internal_review",
        };
      }),
    );

    return {
      continueLearning,
      units: unitCards,
    };
  }
}
