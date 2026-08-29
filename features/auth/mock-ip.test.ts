import { describe, expect, it } from "vitest";
import { generateMockIp } from "@/features/auth/mock-ip";

describe("generateMockIp", () => {
  it("returns a value in the reserved demo range, marked as demo", () => {
    const ip = generateMockIp();
    expect(ip).toMatch(/^192\.0\.2\.\d{1,3} \(demo\)$/);
  });
});
