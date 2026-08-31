import { describe, expect, it } from "vitest";
import { clampPage, pageCount, paginate, visiblePageNumbers } from "./paginate";

describe("paginate", () => {
  it("slices a full page and the remainder", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginate(items, 1, 2)).toEqual([1, 2]);
    expect(paginate(items, 3, 2)).toEqual([5]);
  });

  it("clamps a page past the end down to the last page", () => {
    expect(paginate([1, 2, 3], 9, 2)).toEqual([3]);
    expect(clampPage(9, 3, 2)).toBe(2);
  });

  it("treats an empty list as a single page", () => {
    expect(pageCount(0, 10)).toBe(1);
    expect(paginate([], 1, 10)).toEqual([]);
  });
});

describe("visiblePageNumbers", () => {
  it("lists every page when there are few of them", () => {
    expect(visiblePageNumbers(1, 3)).toEqual([1, 2, 3]);
  });

  it("keeps first, last, and neighbours with ellipses in between", () => {
    expect(visiblePageNumbers(5, 12)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 12]);
  });
});
