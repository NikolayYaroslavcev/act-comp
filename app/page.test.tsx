import { describe, expect, it, vi } from "vitest";
import Home from "./page";

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

describe("Home (root page)", () => {
  it("redirects to /dashboard, which itself handles the authenticated/anonymous split", () => {
    Home();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
