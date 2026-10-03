import { describe, it, expect } from "vitest";
import { NumberedChunkMeter, assertIntegerMinor } from "../src/meter.js";

describe("NumberedChunkMeter (Provider-Side)", () => {
  it("acceptance: 3 chunk -> units=3", () => {
    const meter = new NumberedChunkMeter();

    expect(meter.getUnits()).toBe(0);

    const idx1 = meter.recordChunk("data: chunk one\n\n");
    const idx2 = meter.recordChunk("data: chunk two\n\n");
    const idx3 = meter.recordChunk("data: chunk three\n\n");

    expect(idx1).toBe(1);
    expect(idx2).toBe(2);
    expect(idx3).toBe(3);

    // Acceptance condition
    expect(meter.getUnits()).toBe(3);
  });

  it("calculates cost in integer minor units without floating-point math", () => {
    const meter = new NumberedChunkMeter();
    meter.recordChunk("chunk 1");
    meter.recordChunk("chunk 2");
    meter.recordChunk("chunk 3");

    // 3 units * 1000 lamports = 3000 lamports
    const cost = meter.calculateCostMinor(1000);
    expect(cost).toBe("3000");

    // BigInt price
    const costBigInt = meter.calculateCostMinor(5000n);
    expect(costBigInt).toBe("15000");

    // String price
    const costStr = meter.calculateCostMinor("2500");
    expect(costStr).toBe("7500");
  });

  it("forbids float money (throws error on decimal values)", () => {
    const meter = new NumberedChunkMeter();
    meter.recordChunk("chunk 1");

    expect(() => meter.calculateCostMinor(0.05)).toThrowError(/Float money is forbidden/);
    expect(() => meter.calculateCostMinor(10.5)).toThrowError(/Float money is forbidden/);
    expect(() => meter.calculateCostMinor("10.5")).toThrowError(/Float money is forbidden/);
    expect(() => assertIntegerMinor(-100)).toThrow();
  });

  it("resets state cleanly for subsequent streams", () => {
    const meter = new NumberedChunkMeter();
    meter.recordChunk("a");
    meter.recordChunk("b");
    expect(meter.getUnits()).toBe(2);

    meter.reset();
    expect(meter.getUnits()).toBe(0);
    expect(meter.getHistory()).toHaveLength(0);

    meter.recordChunk("c");
    expect(meter.getUnits()).toBe(1);
  });

  it("records chunk size and timestamps correctly", () => {
    const meter = new NumberedChunkMeter();
    const before = Date.now();
    meter.recordChunk("hello world");
    const after = Date.now();

    const history = meter.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.index).toBe(1);
    expect(history[0]?.sizeBytes).toBe(11);
    expect(history[0]?.timestamp).toBeGreaterThanOrEqual(before);
    expect(history[0]?.timestamp).toBeLessThanOrEqual(after);
  });
});
