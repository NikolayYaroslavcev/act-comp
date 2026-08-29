import { describe, expect, it } from "vitest";
import { parseDevice } from "@/features/auth/device";

describe("parseDevice", () => {
  it("identifies Chrome on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseDevice(ua)).toBe("Chrome on Windows");
  });

  it("identifies Safari on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    expect(parseDevice(ua)).toBe("Safari on macOS");
  });

  it("falls back to a generic label when the header is missing", () => {
    expect(parseDevice(null)).toBe("Unknown device");
  });
});
