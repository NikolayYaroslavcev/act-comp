"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/shared/store/store";

interface StoreProviderProps {
  children: ReactNode;
}

/**
 * One store per browser tab, created on first client render. Never touched
 * server-side, so app/layout.tsx can stay an async server component with
 * this as the only client boundary — no state to hydrate, so no mismatch risk.
 * Lazy useState (rather than a ref) keeps the store stable across re-renders
 * without reading a ref during render.
 */
export function StoreProvider({ children }: StoreProviderProps) {
  const [store] = useState<AppStore>(() => makeStore());

  return <Provider store={store}>{children}</Provider>;
}
