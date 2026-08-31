import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessions } from "@/features/auth/use-sessions";
import type { SessionHistoryItem } from "@/entities/session/dto";

const SESSIONS: SessionHistoryItem[] = [
  {
    id: "s-current",
    ip: "192.0.2.1 (demo)",
    device: "Chrome on Windows",
    createdAt: "2026-08-29T12:00:00.000Z",
    rememberMe: false,
    revokedAt: null,
    isCurrent: true,
  },
];

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSessions", () => {
  it("loads the current user's sessions without sending a userId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { sessions: SESSIONS } })));

    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.sessions).toEqual(SESSIONS);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/auth/sessions");
    expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/userId=/), expect.anything());
  });

  it("exposes a loading state while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useSessions());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.sessions).toEqual([]);

    resolveFetch(jsonResponse(200, { data: { sessions: SESSIONS } }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("shows a session-expired message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "x" } })));

    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.error).toBe("Сессия истекла. Войдите снова"));
    expect(result.current.sessions).toEqual([]);
  });

  it("shows a network error when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useSessions());

    await waitFor(() =>
      expect(result.current.error).toBe(
        "Не удалось соединиться с сервером. Проверьте подключение к интернету",
      ),
    );
  });

  it("keeps an empty list when the user has no history", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { sessions: [] } })));

    const { result } = renderHook(() => useSessions());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessions).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
