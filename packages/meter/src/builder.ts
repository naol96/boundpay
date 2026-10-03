import type {
  BoundPayPaymentMetadata,
  BoundPaySSEMetadataPayload,
  PaymentInfo,
  PaymentMode,
  PaymentAdapter,
} from "./types.js";
import { NumberedChunkMeter, assertIntegerMinor } from "./meter.js";

export interface BuildMetadataOptions {
  units?: number;
  costMinor?: string | bigint | number;
  costPerUnitMinor?: string | bigint | number;
  costMode?: "DEMO_FIXTURE";
  payment?: Partial<PaymentInfo>;
  adapter?: PaymentAdapter;
}

/**
 * Builds the canonical BoundPay payment metadata object adhering to MVP-BE-02 spec.
 *
 * Enforces:
 * - No float money (integer minor units only)
 * - No fake tx signatures (txSignature is null in stub mode)
 * - CostMode is strictly "DEMO_FIXTURE"
 */
export function buildBoundPayMetadata(options: BuildMetadataOptions): BoundPayPaymentMetadata {
  const units = Math.max(0, Math.floor(options.units ?? 0));

  // Determine costMinor without float math
  let costMinor: string;
  if (options.costMinor !== undefined) {
    costMinor = assertIntegerMinor(options.costMinor, "costMinor").toString();
  } else {
    const perUnit = assertIntegerMinor(options.costPerUnitMinor ?? "1", "costPerUnitMinor");
    costMinor = (BigInt(units) * perUnit).toString();
  }

  // Determine payment info
  const adapterMode: PaymentMode = options.payment?.mode ?? options.adapter?.mode ?? "stub";
  const defaultStatus = adapterMode === "stub" ? "simulated" : "pending";
  const status = options.payment?.status ?? defaultStatus;

  let txSignature: string | null = options.payment?.txSignature ?? null;

  // Rule: fake tx signature yok!
  // In stub mode or simulated status, txSignature MUST be null.
  if (adapterMode === "stub" || status === "simulated") {
    if (txSignature !== null) {
      throw new Error(
        `[BoundPay Builder] Fake tx signature is forbidden (G_NO_FAKE_SIG). In stub/simulated mode, txSignature must be null, got: "${txSignature}"`
      );
    }
    txSignature = null;
  }

  const payment: PaymentInfo = {
    mode: adapterMode,
    status,
    txSignature,
  };

  return {
    units,
    costMinor,
    costMode: "DEMO_FIXTURE",
    payment,
  };
}

/**
 * Convenience builder from a NumberedChunkMeter instance.
 */
export function buildMetadataFromMeter(
  meter: NumberedChunkMeter,
  options: Omit<BuildMetadataOptions, "units"> = {}
): BoundPayPaymentMetadata {
  return buildBoundPayMetadata({
    ...options,
    units: meter.getUnits(),
  });
}

/**
 * Wraps canonical metadata into the Frozen Demo Contract SSE payload:
 * { "boundpay": { units, costMinor, costMode, payment } }
 */
export function buildBoundPaySSEPayload(
  metadata: BoundPayPaymentMetadata | BuildMetadataOptions
): BoundPaySSEMetadataPayload {
  const meta =
    "units" in metadata && "costMinor" in metadata && "costMode" in metadata && "payment" in metadata
      ? (metadata as BoundPayPaymentMetadata)
      : buildBoundPayMetadata(metadata as BuildMetadataOptions);
  return {
    boundpay: meta,
  };
}

/**
 * Formats the final SSE metadata event chunk adhering to OpenAI-compatible streaming.
 * Example: `data: {"boundpay":{...}}\n\n`
 */
export function formatBoundPaySSEEvent(
  metadata: BoundPayPaymentMetadata | BuildMetadataOptions
): string {
  return `data: ${JSON.stringify(buildBoundPaySSEPayload(metadata))}\n\n`;
}

/**
 * Returns the canonical OpenAI SSE stream termination chunk.
 * Example: `data: [DONE]\n\n`
 */
export function formatDoneSSEEvent(): string {
  return "data: [DONE]\n\n";
}

