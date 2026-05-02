import { AppError } from "./AppError.js";

export type EntityId = bigint;

export class EntityIdCodec {
  static parse(value: string): EntityId {
    if (!/^[0-9]+$/.test(value)) {
      throw new AppError("validation_failed", "Invalid snowflake id");
    }
    return BigInt(value);
  }

  static stringify(value: EntityId): string {
    return value.toString();
  }
}
