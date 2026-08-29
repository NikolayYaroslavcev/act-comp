import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "@/entities/session/repository";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import DashboardPage from "./page";

const redirectMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("@/widgets/dashboard/welcome-screen", () => ({
  WelcomeScreen: ({ user, stats }: { user: { email: string }; stats: unknown }) => (
    <div
      data-testid="welcome-screen"
      data-user-email={user.email}
      data-stats={JSON.stringify(stats)}
    />
  ),
}));

function cookieJar(sessionId?: string) {
  return {
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && sessionId ? { name, value: sessionId } : undefined,
  };
}

describe("DashboardPage — authenticated visitor", () => {
  it("renders the welcome screen using the current session's user and system stats", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    render(await DashboardPage());

    const welcome = screen.getByTestId("welcome-screen");
    expect(welcome).toHaveAttribute("data-user-email", "admin@example.com");
    expect(welcome.dataset.stats).toContain("totalUsers");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("renders a list card for every list the current user can see", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    render(await DashboardPage());

    const cards = screen.getAllByTestId("list-card");
    expect(cards.length).toBeGreaterThan(1);
    expect(screen.getByRole("heading", { name: "Спринт 34: Backend" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Личные дела" })).toBeInTheDocument();
  });
});

describe("DashboardPage — anonymous visitor", () => {
  it("redirects to /login instead of rendering the welcome screen", async () => {
    cookiesMock.mockResolvedValue(cookieJar());

    await DashboardPage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login for an unknown session id", async () => {
    cookiesMock.mockResolvedValue(cookieJar("does-not-exist"));

    await DashboardPage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
