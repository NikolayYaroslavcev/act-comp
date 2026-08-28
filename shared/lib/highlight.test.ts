import { describe, expect, it } from "vitest";
import { getHighlightSegments } from "./highlight";

describe("getHighlightSegments", () => {
  it("returns the whole text as one unmatched segment for an empty query", () => {
    expect(getHighlightSegments("Hello world", "")).toEqual([{ text: "Hello world", matched: false }]);
  });

  it("returns the whole text as one unmatched segment for a whitespace-only query", () => {
    expect(getHighlightSegments("Hello world", "   ")).toEqual([{ text: "Hello world", matched: false }]);
  });

  it("returns one unmatched segment when there is no match", () => {
    expect(getHighlightSegments("Hello world", "zzz")).toEqual([{ text: "Hello world", matched: false }]);
  });

  it("highlights a match at the start", () => {
    expect(getHighlightSegments("Hello world", "Hello")).toEqual([
      { text: "Hello", matched: true },
      { text: " world", matched: false },
    ]);
  });

  it("highlights a match in the middle", () => {
    expect(getHighlightSegments("say hello world", "hello")).toEqual([
      { text: "say ", matched: false },
      { text: "hello", matched: true },
      { text: " world", matched: false },
    ]);
  });

  it("highlights a match at the end", () => {
    expect(getHighlightSegments("say hello", "hello")).toEqual([
      { text: "say ", matched: false },
      { text: "hello", matched: true },
    ]);
  });

  it("is case-insensitive and preserves the original text casing", () => {
    expect(getHighlightSegments("Hello World", "world")).toEqual([
      { text: "Hello ", matched: false },
      { text: "World", matched: true },
    ]);
  });

  it("highlights several matches", () => {
    expect(getHighlightSegments("cat and cat", "cat")).toEqual([
      { text: "cat", matched: true },
      { text: " and ", matched: false },
      { text: "cat", matched: true },
    ]);
  });

  it("does not let regexp special characters in the query break matching", () => {
    expect(getHighlightSegments("price: $5 (sale)", "$5 (sale)")).toEqual([
      { text: "price: ", matched: false },
      { text: "$5 (sale)", matched: true },
    ]);
  });

  it("joining every segment's text reproduces the original text", () => {
    const text = "The quick brown fox jumps over the lazy fox";
    const segments = getHighlightSegments(text, "fox");
    expect(segments.map((segment) => segment.text).join("")).toBe(text);
  });
});
