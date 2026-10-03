import { describe, it, expect } from "vitest";
import { NumberedChunkMeter } from "../src/meter.js";
import {
  buildBoundPayMetadata,
  buildMetadataFromMeter,
  buildBoundPaySSEPayload,
  formatBoundPaySSEEvent,
  formatDoneSSEEvent,
} from "../src/builder.js";
import { StubPaymentAdapter } from "../src/adapter.js";

describe("PaymentMetadataBuilder (MVP-BE-02)", () => {
  it("acceptance: builds exact minimum output for 3 chunks in stub mode", () => {
    const meter = new NumberedChunkMeter();
    meter.recordChunk("c1");
    meter.recordChunk("c2");
    meter.recordChunk("c3");

    const metadata = buildMetadataFromMeter(meter, {
      costPerUnitMinor: 1000,
    });

    // Verify acceptance criteria
    expect(metadata.units).toBe(3);
    expect(metadata.costMinor).toBe("3000");
    expect(metadata.costMode).toBe("DEMO_FIXTURE");

    expect(metadata.payment).toEqual({
      mode: "stub",
      status: "simulated",
      txSignature: null,
    });
  });

  it("builds metadata with explicit stub adapter", () => {
    const adapter = new StubPaymentAdapter();
    const metadata = buildBoundPayMetadata({
      units: 3,
      costMinor: "3000",
      adapter,
    });

    expect(metadata).toEqual({
      units: 3,
      costMinor: "3000",
      costMode: "DEMO_FIXTURE",
      payment: {
        mode: "stub",
        status: "simulated",
        txSignature: null,
      },
    });
  });

  it("forbids fake tx signature in stub/simulated mode", () => {
    expect(() =>
      buildBoundPayMetadata({
        units: 3,
        costMinor: "3000",
        payment: {
          mode: "stub",
          status: "simulated",
          txSignature: "FakeSignature12345",
        },
      })
    ).toThrowError(/Fake tx signature is forbidden/);
  });

  it("rejects float money in builder cost options", () => {
    expect(() =>
      buildBoundPayMetadata({
        units: 3,
        costMinor: 3.14 as any,
      })
    ).toThrowError(/Float money is forbidden/);

    expect(() =>
      buildBoundPayMetadata({
        units: 3,
        costPerUnitMinor: "10.5",
      })
    ).toThrowError(/Float money is forbidden/);
  });

  it("frozen demo contract: matches exact { boundpay: { units: 3, costMinor: '3', ... } }", () => {
    const meter = new NumberedChunkMeter();
    meter.recordChunk("token_1");
    meter.recordChunk("token_2");
    meter.recordChunk("token_3");

    // With default options (1 chunk = 1 minor unit in demo fixture)
    const payload = buildBoundPaySSEPayload(buildMetadataFromMeter(meter));

    expect(payload).toEqual({
      boundpay: {
        units: 3,
        costMinor: "3",
        costMode: "DEMO_FIXTURE",
        payment: {
          mode: "stub",
          status: "simulated",
          txSignature: null,
        },
      },
    });

    // Formatted SSE event string
    const sseEvent = formatBoundPaySSEEvent(buildMetadataFromMeter(meter));
    expect(sseEvent).toBe(
      `data: ${JSON.stringify(payload)}\n\n`
    );

    // Stream termination event
    expect(formatDoneSSEEvent()).toBe("data: [DONE]\n\n");
  });
});
