/**
 * BoundPay — Payment & Meter Types
 * MVP-BE-02: Provider-side numbered-chunk meter and final payment metadata
 */

export type PaymentMode = "stub" | "devnet";
export type CostMode = "DEMO_FIXTURE";

export interface PaymentInfo {
  mode: PaymentMode;
  status: "simulated" | "pending" | "confirmed" | "settled" | string;
  txSignature: string | null;
}

export interface BoundPayPaymentMetadata {
  units: number;
  costMinor: string;
  costMode: CostMode;
  payment: PaymentInfo;
}

export interface ChunkRecord {
  index: number;
  timestamp: number;
  sizeBytes?: number | undefined;
}

export interface PaymentAdapter {
  readonly mode: PaymentMode;
  isRealReady(): boolean;
  settle(amountMinor: string | bigint | number): Promise<PaymentInfo>;
}
