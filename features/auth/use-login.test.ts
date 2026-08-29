import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLogin } from "@/features/auth/use-login";

const CREDENTIALS = { email: "admin@example.com", password: "Admin123!", rememberMe: false };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLogin", () => {
  it("returns the login result and clears pending state on success", async () => {
    const loginResult = { user: { id: "u1", email: CREDENTIALS.email }, session: { id: "s1" } };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: loginResult }))
    );

    const { result } = renderHook(() => useLogin());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.login(CREDENTIALS);
    });

    expect(returned).toEqual(loginResult);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(CREDENTIALS),
      })
    );
  });

  it("sets isPending while the request is in flight", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    const { result } = renderHook(() => useLogin());

    let loginPromise!: Promise<unknown>;
    act(() => {
      loginPromise = result.current.login(CREDENTIALS);
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolveFetch(jsonResponse(200, { data: { user: {}, session: {} } }));
    await act(async () => {
      await loginPromise;
    });

    expect(result.current.isPending).toBe(false);
  });

  it("shows an invalid-credentials message for a 401 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "x" } })));

    const { result } = renderHook(() => useLogin());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.login(CREDENTIALS);
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe("Неверный email или пароль");
    expect(result.current.isPending).toBe(false);
  });

  it("shows a validation message for a 400 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "x" } })));

    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login(CREDENTIALS);
    });

    expect(result.current.error).toBe("Проверьте правильность заполнения формы");
  });

  it("shows a generic message for an unexpected server error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));

    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login(CREDENTIALS);
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });

  it("shows a network error message when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login(CREDENTIALS);
    });

    expect(result.current.error).toBe(
      "Не удалось соединиться с сервером. Проверьте подключение к интернету"
    );
    expect(result.current.isPending).toBe(false);
  });

  it("shows a generic message when the response body is not the expected shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { unexpected: true })));

    const { result } = renderHook(() => useLogin());

    await act(async () => {
      await result.current.login(CREDENTIALS);
    });

    expect(result.current.error).toBe("Что-то пошло не так. Попробуйте ещё раз");
  });
});
