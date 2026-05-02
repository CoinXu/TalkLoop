import { describe, expect, it } from "vitest";
import { SnowflakeIdGenerator } from "./SnowflakeIdGenerator.js";

describe("SnowflakeIdGenerator", () => {
  it("generates increasing bigint ids", () => {
    const generator = new SnowflakeIdGenerator(1n);

    const first = generator.nextId();
    const second = generator.nextId();

    expect(typeof first).toBe("bigint");
    expect(second > first).toBe(true);
  });
});
