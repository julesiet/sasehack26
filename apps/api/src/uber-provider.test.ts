import { beforeEach, describe, expect, it } from "vitest";
import { createControlledUberProvider } from "./uber-provider";

describe("createControlledUberProvider", () => {
  it("returns UberX and accessible WAV at the demo prices", () => {
    const uber = createControlledUberProvider();
    const result = uber.findOptions({
      pickup: "412 Willow Lane, Springfield",
      destination: "Springfield Family Medicine, 88 Oak St, Springfield",
      arriveBy: "2026-09-20T10:15:00",
    });
    expect(result.success).toBe(true);
    expect(result.options).toEqual([
      expect.objectContaining({
        optionId: "uberx_1",
        provider: "uber",
        product: "UberX",
        estimate: "$18.00",
        accessible: false,
      }),
      expect.objectContaining({
        optionId: "uber_wav_1",
        provider: "uber",
        product: "WAV",
        estimate: "$24.50",
        accessible: true,
      }),
    ]);
    expect(result.summary).toContain("Uber");
  });

  it("fails booking when the option was never quoted", () => {
    const uber = createControlledUberProvider();
    const result = uber.book("unknown_option");
    expect(result.success).toBe(false);
    expect(result.confirmationId).toBeUndefined();
    expect(result.booking).toBeUndefined();
  });

  it("books WAV with a re-readable confirmation id", () => {
    const uber = createControlledUberProvider();
    const result = uber.book("uber_wav_1");
    expect(result.success).toBe(true);
    expect(result.confirmationId).toBe("UBER-WAV-0001");
    expect(result.booking).toEqual({
      provider: "uber",
      optionId: "uber_wav_1",
      status: "booked",
    });
    const second = uber.book("uberx_1");
    expect(second.confirmationId).toBe("UBER-UBERX-0002");
  });

  it("fails loudly when the post-write lookup misses", () => {
    const uber = createControlledUberProvider({ failNextVerify: true });
    const result = uber.book("uber_wav_1");
    expect(result.success).toBe(false);
    expect(result.confirmationId).toBeUndefined();
    expect(result.booking).toBeUndefined();
    const retry = uber.book("uber_wav_1");
    expect(retry.success).toBe(true);
    expect(retry.confirmationId).toBe("UBER-WAV-0002");
  });
});
