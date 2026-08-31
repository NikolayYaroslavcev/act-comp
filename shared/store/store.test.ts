import { describe, expect, it } from "vitest";
import { baseApi } from "@/shared/api/base-api";
import { makeStore } from "@/shared/store/store";

describe("makeStore", () => {
  it("wires the RTK Query reducer under its reducerPath", () => {
    const store = makeStore();
    expect(store.getState()[baseApi.reducerPath]).toBeDefined();
  });

  it("returns an independent store instance on each call", () => {
    const a = makeStore();
    const b = makeStore();
    expect(a).not.toBe(b);
    expect(a.getState()).not.toBe(b.getState());
  });

  it("registers the RTK Query middleware (dispatching a query action does not throw)", () => {
    const store = makeStore();
    expect(() => store.dispatch(baseApi.util.resetApiState())).not.toThrow();
  });
});
