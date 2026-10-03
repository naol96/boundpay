import type { ChunkRecord } from "./types.js";

/**
 * Validates that an input represents a non-negative integer minor unit (no floats).
 * Rejects numbers with decimal points or non-integer floats.
 */
export function assertIntegerMinor(value: string | bigint | number, paramName = "value"): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error(`[BoundPay Meter] ${paramName} must be non-negative, got: ${value}`);
    }
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      throw new Error(
        `[BoundPay Meter] Float money is forbidden (G_NO_FLOAT). ${paramName} must be a non-negative integer, got: ${value}`
      );
    }
    return BigInt(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(
        `[BoundPay Meter] Float money is forbidden (G_NO_FLOAT). ${paramName} string must contain only digits, got: "${value}"`
      );
    }
    return BigInt(trimmed);
  }

  throw new Error(`[BoundPay Meter] Invalid type for ${paramName}: ${typeof value}`);
}

/**
 * Provider-Side Numbered-Chunk Meter
 *
 * Implements ADR-001: 1 numbered chunk = 1 unit.
 * Tracks incoming/emitted streaming chunks sequentially strictly on the provider side.
 */
export class NumberedChunkMeter {
  private chunks: ChunkRecord[] = [];
  private currentCount = 0;

  /**
   * Records a chunk emission/delivery on the provider side.
   * Increments total units and returns the 1-based sequential chunk index.
   */
  public recordChunk(data?: unknown): number {
    this.currentCount += 1;
    const index = this.currentCount;

    let sizeBytes: number | undefined;
    if (typeof data === "string") {
      sizeBytes = new TextEncoder().encode(data).byteLength;
    } else if (data instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer(data))) {
      sizeBytes = data.byteLength;
    }

    this.chunks.push({
      index,
      timestamp: Date.now(),
      sizeBytes,
    });

    return index;
  }

  /**
   * Returns the total number of measured units.
   * Acceptance: 3 chunks recorded -> units = 3.
   */
  public getUnits(): number {
    return this.currentCount;
  }

  /**
   * Calculates total cost in minor units (e.g. lamports) without floating point math.
   * Returns cost as an integer string.
   */
  public calculateCostMinor(costPerUnitMinor: string | bigint | number = "1000"): string {
    const perUnit = assertIntegerMinor(costPerUnitMinor, "costPerUnitMinor");
    const unitsBigInt = BigInt(this.getUnits());
    const totalMinor = unitsBigInt * perUnit;
    return totalMinor.toString();
  }

  /**
   * Returns an immutable copy of the chunk delivery history.
   */
  public getHistory(): ReadonlyArray<ChunkRecord> {
    return [...this.chunks];
  }

  /**
   * Resets the meter counter and history for a new stream session.
   */
  public reset(): void {
    this.chunks = [];
    this.currentCount = 0;
  }
}
