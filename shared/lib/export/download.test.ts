import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("triggers a download through a temporary object URL", () => {
    const click = vi.fn();
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:export",
      revokeObjectURL: revoke,
    });

    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = click;
    try {
      downloadBlob(new Blob(["csv"], { type: "text/csv" }), "list-tasks.csv");
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }

    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:export");
  });
});
