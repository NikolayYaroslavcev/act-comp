import { describe, expect, it } from "vitest";
import { isDarkTheme } from "@/features/settings/apply-theme";

describe("isDarkTheme", () => {
  it("is dark when the preference is dark, regardless of the system", () => {
    expect(isDarkTheme("dark", true)).toBe(true);
    expect(isDarkTheme("dark", false)).toBe(true);
  });

  it("is not dark when the preference is light, regardless of the system", () => {
    expect(isDarkTheme("light", true)).toBe(false);
    expect(isDarkTheme("light", false)).toBe(false);
  });

  it("follows the system preference when the theme is system", () => {
    expect(isDarkTheme("system", true)).toBe(true);
    expect(isDarkTheme("system", false)).toBe(false);
  });
});
