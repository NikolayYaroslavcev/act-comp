import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format-date";

const SAMPLE_ISO = "2026-03-05T14:30:00.000Z";

describe("formatDate", () => {
  it("formats an ISO date string using the app's canonical date-only format", () => {
    const expected = new Intl.DateTimeFormat("ru", { dateStyle: "medium" }).format(new Date(SAMPLE_ISO));

    expect(formatDate(SAMPLE_ISO)).toBe(expected);
  });
});

describe("formatDateTime", () => {
  it("formats an ISO date string using the app's canonical date+time format", () => {
    const expected = new Intl.DateTimeFormat("ru", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(SAMPLE_ISO),
    );

    expect(formatDateTime(SAMPLE_ISO)).toBe(expected);
  });

  it("produces a different (longer) string than formatDate, since it also includes the time", () => {
    expect(formatDateTime(SAMPLE_ISO)).not.toBe(formatDate(SAMPLE_ISO));
  });
});
