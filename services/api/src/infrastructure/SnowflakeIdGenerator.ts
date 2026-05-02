export class SnowflakeIdGenerator {
  private readonly epochMs = 1735689600000n;
  private readonly workerIdBits = 10n;
  private readonly sequenceBits = 12n;
  private readonly maxSequence = (1n << this.sequenceBits) - 1n;
  private sequence = 0n;
  private lastTimestampMs = -1n;

  constructor(private readonly workerId: bigint = 1n) {
    const maxWorkerId = (1n << this.workerIdBits) - 1n;
    if (workerId < 0n || workerId > maxWorkerId) {
      throw new Error("Snowflake worker id out of range");
    }
  }

  nextId(): bigint {
    let timestampMs = this.currentTimestampMs();

    if (timestampMs < this.lastTimestampMs) {
      throw new Error("System clock moved backwards");
    }

    if (timestampMs === this.lastTimestampMs) {
      this.sequence = (this.sequence + 1n) & this.maxSequence;
      if (this.sequence === 0n) {
        timestampMs = this.waitNextMillis(timestampMs);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestampMs = timestampMs;

    const id =
      ((timestampMs - this.epochMs) << (this.workerIdBits + this.sequenceBits)) |
      (this.workerId << this.sequenceBits) |
      this.sequence;

    return id;
  }

  now(): Date {
    return new Date();
  }

  private currentTimestampMs(): bigint {
    return BigInt(Date.now());
  }

  private waitNextMillis(timestampMs: bigint): bigint {
    let nextTimestampMs = this.currentTimestampMs();
    while (nextTimestampMs <= timestampMs) {
      nextTimestampMs = this.currentTimestampMs();
    }
    return nextTimestampMs;
  }
}
