import type { Theme } from "@/entities/user/schema";

export function isDarkTheme(theme: Theme, prefersDark: boolean): boolean {
  if (theme === "dark") {
    return true;
  }
  if (theme === "light") {
    return false;
  }
  return prefersDark;
}

export function applyDocumentTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  const prefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.toggle("dark", isDarkTheme(theme, prefersDark));
}
