import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { baseApi } from "@/shared/api/base-api";
import { makeStore } from "@/shared/store/store";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const probeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProbe: builder.query<{ id: string }, string>({
      query: (id) => `/probe/${id}`,
      transformResponse: (response: { data: { id: string } }) => response.data,
      providesTags: (_result, _error, id) => [{ type: "Task", id }],
    }),
    breakProbe: builder.mutation<void, string>({
      query: (id) => ({ url: `/probe/${id}`, method: "PATCH" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Task", id }],
    }),
  }),
  overrideExisting: false,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("base-api", () => {
  it("unwraps the { data } envelope for a successful query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { id: "1" } })));
    const store = makeStore();

    const result = await store.dispatch(probeApi.endpoints.getProbe.initiate("1"));

    expect(result.data).toEqual({ id: "1" });
  });

  it("surfaces a non-2xx response as a query error with the HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: { message: "Not found" } })));
    const store = makeStore();

    const result = await store.dispatch(probeApi.endpoints.getProbe.initiate("missing"));

    expect(result.error).toBeDefined();
    expect((result.error as { status?: number })?.status).toBe(404);
  });

  it("sends requests with same-origin credentials so the session cookie is included", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { id: "1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();

    await store.dispatch(probeApi.endpoints.getProbe.initiate("1"));

    // fetchBaseQuery calls fetchFn with a single Request object, not
    // fetch(url, init) — assert on the constructed Request's own properties.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe(`${window.location.origin}/api/probe/1`);
    expect(request.credentials).toBe("same-origin");
  });

  it("invalidating a tag refetches an actively subscribed query for that tag", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "1" } }))
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "1-updated" } }));
    vi.stubGlobal("fetch", fetchMock);
    const store = makeStore();

    const subscription = store.dispatch(probeApi.endpoints.getProbe.initiate("1"));
    await subscription;

    await store.dispatch(probeApi.endpoints.breakProbe.initiate("1"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    subscription.unsubscribe();
  });
});
