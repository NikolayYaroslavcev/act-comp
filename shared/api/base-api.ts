import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// fetchBaseQuery builds a native `Request` internally, which (unlike a real
// browser resolving a relative URL against document.baseURI) requires an
// absolute URL under Node's fetch/Request implementation — the one jsdom
// test environments run on. Prefixing with the current origin produces the
// same effective URL a bare "/api" would in a real browser, while also
// being a valid absolute URL under Node (jsdom's default test origin is
// "http://localhost:3000"). Falls back to a relative path only if this
// module is ever evaluated with no `window` (never expected at runtime,
// since every consumer is a client-only hook), so import itself stays safe.
const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/api` : "/api";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl, credentials: "same-origin" }),
  tagTypes: ["Notification", "Comment", "Task", "Activity"],
  endpoints: () => ({}),
});
