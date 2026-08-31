import { describe, expect, it } from "vitest";
import { formatDurationMinutes } from "./format-duration";

describe("formatDurationMinutes", () => {
  it("formats 0 minutes as 0m", () => {
    expect(formatDurationMinutes(0)).toBe("0m");
  });

  it("formats 1 minute as 1m", () => {
    expect(formatDurationMinutes(1)).toBe("1m");
  });

  it("formats 59 minutes as 59m", () => {
    expect(formatDurationMinutes(59)).toBe("59m");
  });

  it("formats 60 minutes as 1h", () => {
    expect(formatDurationMinutes(60)).toBe("1h");
  });

  it("formats 61 minutes as 1h 1m", () => {
    expect(formatDurationMinutes(61)).toBe("1h 1m");
  });

  it("formats 119 minutes as 1h 59m", () => {
    expect(formatDurationMinutes(119)).toBe("1h 59m");
  });

  it("formats 120 minutes as 2h", () => {
    expect(formatDurationMinutes(120)).toBe("2h");
  });

  it("formats 121 minutes as 2h 1m", () => {
    expect(formatDurationMinutes(121)).toBe("2h 1m");
  });

  it("formats 125 minutes as 2h 5m", () => {
    expect(formatDurationMinutes(125)).toBe("2h 5m");
  });

  it("formats multi-hour durations, e.g. 600 minutes as 10h", () => {
    expect(formatDurationMinutes(600)).toBe("10h");
  });

  it("clamps negative values to 0m", () => {
    expect(formatDurationMinutes(-30)).toBe("0m");
  });

  it("treats NaN as 0m", () => {
    expect(formatDurationMinutes(NaN)).toBe("0m");
  });

  it("treats Infinity as 0m", () => {
    expect(formatDurationMinutes(Infinity)).toBe("0m");
  });

  it("treats -Infinity as 0m", () => {
    expect(formatDurationMinutes(-Infinity)).toBe("0m");
  });

  it("treats null as 0m (defensive against runtime values outside the type)", () => {
    expect(formatDurationMinutes(null as unknown as number)).toBe("0m");
  });

  it("treats undefined as 0m (defensive against runtime values outside the type)", () => {
    expect(formatDurationMinutes(undefined as unknown as number)).toBe("0m");
  });

  it("truncates fractional minutes without floating point drift", () => {
    expect(formatDurationMinutes(61.9)).toBe("1h 1m");
  });

  it("formats exactly 1 day (1440 minutes) as 1d", () => {
    expect(formatDurationMinutes(1440)).toBe("1d");
  });

  it("formats 1 day and 1 hour as 1d 1h", () => {
    expect(formatDurationMinutes(1500)).toBe("1d 1h");
  });

  it("formats 1 day, 1 hour and 5 minutes as 1d 1h 5m", () => {
    expect(formatDurationMinutes(1505)).toBe("1d 1h 5m");
  });

  it("formats several days with no remainder as Nd", () => {
    expect(formatDurationMinutes(3 * 1440)).toBe("3d");
  });
});
