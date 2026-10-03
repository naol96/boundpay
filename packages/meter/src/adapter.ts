import type { PaymentAdapter, PaymentInfo, PaymentMode } from "./types.js";
import { assertIntegerMinor } from "./meter.js";

/**
 * Stub Payment Adapter (Default MVP Mode)
 *
 * Used when Ömer has not yet declared REAL READY.
 * In stub mode:
 * - status is strictly "simulated"
 * - txSignature is strictly null (NO fake/mock tx signatures!)
 */
export class StubPaymentAdapter implements PaymentAdapter {
  public readonly mode: PaymentMode = "stub";

  public isRealReady(): boolean {
    return false;
  }

  public async settle(amountMinor: string | bigint | number): Promise<PaymentInfo> {
    assertIntegerMinor(amountMinor, "amountMinor");

    return {
      mode: "stub",
      status: "simulated",
      txSignature: null, // Strictly null, fake tx signatures are forbidden
    };
  }
}

/**
 * Optional Devnet Payment Adapter Hook
 *
 * Can be connected to Ömer's verified Payment Channels chain adapter
 * once REAL READY is signaled.
 */
export interface VerifiedChainSigner {
  settleChannel?(amountMinor: bigint): Promise<{ signature: string }>;
}

export class DevnetPaymentAdapter implements PaymentAdapter {
  public readonly mode: PaymentMode = "devnet";
  private verifiedSigner?: VerifiedChainSigner | undefined;

  constructor(verifiedSigner?: VerifiedChainSigner) {
    this.verifiedSigner = verifiedSigner;
  }

  public isRealReady(): boolean {
    return Boolean(this.verifiedSigner && typeof this.verifiedSigner.settleChannel === "function");
  }

  public async settle(amountMinor: string | bigint | number): Promise<PaymentInfo> {
    const minor = assertIntegerMinor(amountMinor, "amountMinor");

    if (!this.isRealReady() || !this.verifiedSigner?.settleChannel) {
      // If not REAL READY, fallback safely to stub behavior without inventing fake signatures
      return {
        mode: "stub",
        status: "simulated",
        txSignature: null,
      };
    }

    try {
      const res = await this.verifiedSigner.settleChannel(minor);
      return {
        mode: "devnet",
        status: "settled",
        txSignature: res.signature,
      };
    } catch {
      return {
        mode: "devnet",
        status: "failed",
        txSignature: null,
      };
    }
  }
}

/**
 * Factory helper to get the appropriate payment adapter.
 * Defaults to StubPaymentAdapter unless verified chain adapter is ready.
 */
export function getPaymentAdapter(options?: {
  realReady?: boolean;
  verifiedSigner?: VerifiedChainSigner;
}): PaymentAdapter {
  if (options?.realReady && options.verifiedSigner) {
    return new DevnetPaymentAdapter(options.verifiedSigner);
  }
  return new StubPaymentAdapter();
}
