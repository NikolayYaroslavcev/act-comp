import { describe, expect, it } from "vitest";
import { calculateWorkingElapsedMinutes, calculateWorkingElapsedMs, projectWorkingCompletionMs } from "./working-elapsed";

const T0 = "2026-08-29T10:00:00.000Z";

describe("calculateWorkingElapsedMinutes", () => {
  it("returns 0 when end equals start", () => {
    expect(calculateWorkingElapsedMinutes(T0, T0, 8)).toBe(0);
  });

  it("returns 0 when end is before start", () => {
    expect(calculateWorkingElapsedMinutes("2026-08-29T12:00:00.000Z", T0, 8)).toBe(0);
  });

  it("counts wall-clock minutes when the span is shorter than one work day", () => {
    expect(calculateWorkingElapsedMinutes(T0, "2026-08-29T10:45:00.000Z", 8)).toBe(45);
  });

  it("caps a same-calendar-day span at workDayHours * 60", () => {
    expect(calculateWorkingElapsedMinutes(T0, "2026-08-29T20:00:00.000Z", 8)).toBe(8 * 60);
  });

  it("equals a full work day when the same-day span is exactly workDayHours", () => {
    expect(calculateWorkingElapsedMinutes(T0, "2026-08-29T18:00:00.000Z", 8)).toBe(8 * 60);
  });

  it("caps each UTC calendar day separately when the interval crosses midnight", () => {
    // 23:00–00:00 and 00:00–02:00: two days, each under a 2h cap → 180 minutes, not 120.
    expect(
      calculateWorkingElapsedMinutes("2026-08-29T23:00:00.000Z", "2026-08-30T02:00:00.000Z", 2),
    ).toBe(180);
  });

  it("caps both sides of midnight when each UTC day exceeds workDayHours", () => {
    // 10:00 day1 through 10:00 day2: 14h then 10h, each capped at 8h → 16h.
    expect(calculateWorkingElapsedMinutes(T0, "2026-08-30T10:00:00.000Z", 8)).toBe(16 * 60);
  });

  it("matches wall-clock minutes when workDayHours is 24", () => {
    expect(calculateWorkingElapsedMinutes(T0, "2026-08-30T10:00:00.000Z", 24)).toBe(24 * 60);
  });

  it("is deterministic for the same timestamps", () => {
    const first = calculateWorkingElapsedMinutes(T0, "2026-08-29T13:07:00.000Z", 6);
    const second = calculateWorkingElapsedMinutes(new Date(T0), new Date("2026-08-29T13:07:00.000Z"), 6);
    expect(first).toBe(second);
    expect(first).toBe(187);
  });

  it("floors partial minutes", () => {
    expect(calculateWorkingElapsedMinutes(T0, "2026-08-29T10:01:30.000Z", 8)).toBe(1);
  });

  it("rejects non-positive workDayHours", () => {
    expect(() => calculateWorkingElapsedMinutes(T0, "2026-08-29T11:00:00.000Z", 0)).toThrow();
    expect(() => calculateWorkingElapsedMinutes(T0, "2026-08-29T11:00:00.000Z", -8)).toThrow();
  });

  it("rejects non-finite or above-24 workDayHours", () => {
    expect(() => calculateWorkingElapsedMinutes(T0, "2026-08-29T11:00:00.000Z", Number.NaN)).toThrow();
    expect(() => calculateWorkingElapsedMinutes(T0, "2026-08-29T11:00:00.000Z", Number.POSITIVE_INFINITY)).toThrow();
    expect(() => calculateWorkingElapsedMinutes(T0, "2026-08-29T11:00:00.000Z", 25)).toThrow();
  });
});

describe("projectWorkingCompletionMs", () => {
  it("returns the start instant unchanged when adding 0 minutes", () => {
    expect(projectWorkingCompletionMs(T0, 0, 8)).toBe(Date.parse(T0));
  });

  it("adds wall-clock minutes 1:1 when they fit in the remainder of the current day's cap", () => {
    // 10:00 + 45m, well under the 8h cap and the ~14h left in the UTC day.
    expect(projectWorkingCompletionMs(T0, 45, 8)).toBe(Date.parse("2026-08-29T10:45:00.000Z"));
  });

  it("jumps to the next UTC midnight once the current day's cap is exhausted", () => {
    // 8h cap reached at 18:00; the remaining 30 working minutes roll to the next day.
    expect(projectWorkingCompletionMs(T0, 8 * 60 + 30, 8)).toBe(Date.parse("2026-08-30T00:30:00.000Z"));
  });

  it("spans multiple full capped days for a long remaining duration", () => {
    // 8h cap/day: day1 consumes 8h (10:00->18:00, capped), day2 a full 8h (00:00->08:00),
    // day3 the final 4h (00:00->04:00) => 20h of working minutes total.
    expect(projectWorkingCompletionMs(T0, 20 * 60, 8)).toBe(Date.parse("2026-08-31T04:00:00.000Z"));
  });

  it("is the exact inverse of calculateWorkingElapsedMs for a same-day span", () => {
    const end = projectWorkingCompletionMs(T0, 45, 8);
    expect(calculateWorkingElapsedMs(T0, end, 8)).toBe(45 * 60_000);
  });

  it("is the exact inverse of calculateWorkingElapsedMs across a capped multi-day span", () => {
    const minutes = 20 * 60;
    const end = projectWorkingCompletionMs(T0, minutes, 8);
    expect(calculateWorkingElapsedMs(T0, end, 8)).toBe(minutes * 60_000);
  });

  it("matches wall-clock addition when workDayHours is 24", () => {
    expect(projectWorkingCompletionMs(T0, 30 * 60, 24)).toBe(Date.parse("2026-08-30T16:00:00.000Z"));
  });

  it("produces a later result for a smaller workDayHours given the same remaining minutes", () => {
    const withEightHourDay = projectWorkingCompletionMs(T0, 6 * 60, 8);
    const withFourHourDay = projectWorkingCompletionMs(T0, 6 * 60, 4);
    expect(withFourHourDay).toBeGreaterThan(withEightHourDay);
  });

  it("rejects non-positive or above-24 workDayHours", () => {
    expect(() => projectWorkingCompletionMs(T0, 30, 0)).toThrow();
    expect(() => projectWorkingCompletionMs(T0, 30, 25)).toThrow();
  });

  it("is deterministic for the same inputs", () => {
    const first = projectWorkingCompletionMs(T0, 500, 6);
    const second = projectWorkingCompletionMs(new Date(T0), 500, 6);
    expect(first).toBe(second);
  });
});
