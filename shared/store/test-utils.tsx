import type { ReactElement, ReactNode } from "react";
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderHookResult,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/shared/store/store";

export type RenderHookWithStoreOptions<Props> = Omit<RenderHookOptions<Props>, "wrapper"> & {
  store?: AppStore;
};

export interface RenderHookWithStoreResult<Result, Props> extends RenderHookResult<Result, Props> {
  store: AppStore;
}

/**
 * renderHook + a fresh (or caller-supplied) Redux store per call, wrapped in
 * react-redux's Provider. Every hook test gets its own store instance unless
 * one is explicitly passed in, so RTK Query cache never leaks between tests.
 */
export function renderHookWithStore<Result, Props>(
  callback: (props: Props) => Result,
  options?: RenderHookWithStoreOptions<Props>,
): RenderHookWithStoreResult<Result, Props> {
  const store = options?.store ?? makeStore();

  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  const result = renderHook(callback, { ...options, wrapper: Wrapper });
  return { store, ...result };
}

export type RenderWithStoreOptions = Omit<RenderOptions, "wrapper"> & { store?: AppStore };

export interface RenderWithStoreResult extends RenderResult {
  store: AppStore;
}

/**
 * RTL's render() + a fresh (or caller-supplied) Redux store, for components
 * that mount an RTK-Query-backed hook somewhere in their tree (e.g.
 * TaskComments via useTaskComments). Same isolation guarantee as
 * renderHookWithStore: one store per call unless one is passed in.
 */
export function renderWithStore(ui: ReactElement, options?: RenderWithStoreOptions): RenderWithStoreResult {
  const store = options?.store ?? makeStore();

  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  const result = render(ui, { ...options, wrapper: Wrapper });
  return { store, ...result };
}
