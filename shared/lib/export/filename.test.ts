import { describe, expect, it } from "vitest";
import { exportFilename } from "./filename";

describe("exportFilename", () => {
  it("uses a readable list-name suffix", () => {
    expect(exportFilename("Спринт 34", "csv")).toBe("Спринт 34-tasks.csv");
    expect(exportFilename("Спринт 34", "pdf")).toBe("Спринт 34-tasks.pdf");
  });

  it("replaces characters that are unsafe in filenames", () => {
    expect(exportFilename('a/b\\c:d*e?f"g<h>i|j', "csv")).toBe("a_b_c_d_e_f_g_h_i_j-tasks.csv");
  });

  it("falls back when the title sanitises to empty", () => {
    expect(exportFilename("***", "csv")).toBe("list-tasks.csv");
  });
});
