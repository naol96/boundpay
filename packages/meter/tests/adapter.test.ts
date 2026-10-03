import { describe, it, expect } from "vitest";
import { StubPaymentAdapter, DevnetPaymentAdapter, getPaymentAdapter } from "../src/adapter.js";

describe("PaymentAdapter (Stub & Devnet Hook)", () => {
  it("stub adapter returns simulated status with null txSignature", async () => {
    const adapter = new StubPaymentAdapter();

    expect(adapter.mode).toBe("stub");
    expect(adapter.isRealReady()).toBe(false);

    const result = await adapter.settle(3000);
    expect(result).toEqual({
      mode: "stub",
      status: "simulated",
      txSignature: null,
    });
  });

  it("getPaymentAdapter defaults to stub adapter when REAL READY is not set", () => {
    const adapter = getPaymentAdapter();
    expect(adapter.mode).toBe("stub");
    expect(adapter.isRealReady()).toBe(false);
  });

  it("devnet adapter connects to verified chain adapter when REAL READY is provided", async () => {
    const mockVerifiedSigner = {
      settleChannel: async (amount: bigint) => ({
        signature: `real_solana_tx_sig_for_${amount}`,
      }),
    };

    const adapter = new DevnetPaymentAdapter(mockVerifiedSigner);
    expect(adapter.mode).toBe("devnet");
    expect(adapter.isRealReady()).toBe(true);

    const result = await adapter.settle(5000);
    expect(result).toEqual({
      mode: "devnet",
      status: "settled",
      txSignature: "real_solana_tx_sig_for_5000",
    });
  });

  it("devnet adapter safely falls back to simulated stub when verified signer is missing", async () => {
    const adapter = new DevnetPaymentAdapter(undefined);
    expect(adapter.isRealReady()).toBe(false);

    const result = await adapter.settle(3000);
    expect(result).toEqual({
      mode: "stub",
      status: "simulated",
      txSignature: null,
    });
  });
});
