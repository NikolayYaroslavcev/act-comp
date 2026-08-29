import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeSync } from "./theme-sync";

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? matches : !matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
});

describe("ThemeSync", () => {
  it("adds the dark class for the dark theme", () => {
    stubMatchMedia(false);
    render(<ThemeSync theme="dark" />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes the dark class for the light theme", () => {
    document.documentElement.classList.add("dark");
    stubMatchMedia(true);
    render(<ThemeSync theme="light" />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows the system preference when theme is system", () => {
    stubMatchMedia(true);
    render(<ThemeSync theme="system" />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
