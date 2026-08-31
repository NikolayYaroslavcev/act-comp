import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateTime } from "@/shared/lib/format-date";
import { SessionsSection } from "./sessions-section";
import type { SessionHistoryItem } from "@/entities/session/dto";
// useLogoutAll now dispatches to the Redux store (cache reset on logout) —
// renderWithStore supplies a fresh store per test. Test-harness change only.
import { renderWithStore as render } from "@/shared/store/test-utils";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CURRENT: SessionHistoryItem = {
  id: "s-current",
  ip: "192.0.2.1 (demo)",
  device: "Chrome on Windows",
  createdAt: "2026-08-29T12:00:00.000Z",
  rememberMe: false,
  revokedAt: null,
  isCurrent: true,
};

const OTHER: SessionHistoryItem = {
  id: "s-other",
  ip: "192.0.2.2 (demo)",
  device: "Firefox on Linux",
  createdAt: "2026-08-28T09:30:00.000Z",
  rememberMe: true,
  revokedAt: "2026-08-28T18:00:00.000Z",
  isCurrent: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

describe("SessionsSection", () => {
  it("shows a loading state while history is fetching", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<SessionsSection />);

    expect(screen.getByRole("status")).toHaveTextContent(/загрузк/i);
  });

  it("shows an empty state when there is no history", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { sessions: [] } })));
    render(<SessionsSection />);

    expect(await screen.findByText(/нет записей о входах/i)).toBeInTheDocument();
  });

  it("shows an error state when history cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "x" } })));
    render(<SessionsSection />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/сессия истекла/i);
  });

  it("renders login time, device, and IP for each session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: { sessions: [CURRENT, OTHER] } })),
    );
    render(<SessionsSection />);

    expect(await screen.findByText(formatDateTime(CURRENT.createdAt))).toBeInTheDocument();
    expect(screen.getByText(formatDateTime(OTHER.createdAt))).toBeInTheDocument();
    expect(screen.getByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("192.0.2.1 (demo)")).toBeInTheDocument();
    expect(screen.getByText("Firefox on Linux")).toBeInTheDocument();
    expect(screen.getByText("192.0.2.2 (demo)")).toBeInTheDocument();
    expect(screen.getByText(/текущая/i)).toBeInTheDocument();
    expect(screen.queryByTestId("sessions-pagination")).not.toBeInTheDocument();
  });

  it("paginates when there are more sessions than one page", async () => {
    const user = userEvent.setup();
    const sessions = Array.from({ length: 11 }, (_, index) => ({
      id: `s${index + 1}`,
      ip: `192.0.2.${index + 1} (demo)`,
      device: `Device ${index + 1}`,
      createdAt: "2026-08-28T09:30:00.000Z",
      rememberMe: false,
      revokedAt: null,
      isCurrent: index === 0,
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: { sessions } })));
    render(<SessionsSection />);

    expect(await screen.findByText("Device 1", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText(/Device \d+/)).toHaveLength(10);
    expect(screen.queryByText("Device 11", { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая страница" }));

    expect(screen.getByText("Device 11", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Device 1", { exact: true })).not.toBeInTheDocument();
  });

  it("does not call logout-all when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { sessions: [CURRENT] } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionsSection />);

    await user.click(await screen.findByRole("button", { name: /выйти со всех устройств/i }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("logout-all"))).toBe(false);
  });

  it("shows pending and success states after confirming logout-all", async () => {
    const user = userEvent.setup();
    let resolveLogout: (value: Response) => void = () => {};
    const logoutPending = new Promise<Response>((resolve) => {
      resolveLogout = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo) => {
      if (String(input).includes("logout-all")) {
        return logoutPending;
      }
      return Promise.resolve(jsonResponse(200, { data: { sessions: [CURRENT] } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionsSection />);

    await user.click(await screen.findByRole("button", { name: /выйти со всех устройств/i }));
    await user.click(screen.getByRole("button", { name: /выйти везде/i }));

    const pendingButton = screen.getByRole("button", { name: /завершение сессий/i });
    expect(pendingButton).toBeDisabled();

    resolveLogout(jsonResponse(200, { data: { success: true } }));

    expect(await screen.findByRole("status")).toHaveTextContent(/вышли со всех устройств/i);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
