"use client";

import { useEffect } from "react";
import type { Theme } from "@/entities/user/schema";
import { applyDocumentTheme } from "@/features/settings/apply-theme";

interface ThemeSyncProps {
  theme: Theme;
}

export function ThemeSync({ theme }: ThemeSyncProps) {
  useEffect(() => {
    applyDocumentTheme(theme);
    if (theme !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDocumentTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return null;
}
