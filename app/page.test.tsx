import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "@/entities/session/repository";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import Home from "./page";

const redirectMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("@/widgets/welcome/public-welcome", () => ({
  PublicWelcome: ({ stats }: { stats: unknown }) => (
    <div data-testid="public-welcome" data-stats={JSON.stringify(stats)} />
  ),
}));

function cookieJar(sessionId?: string) {
  return {
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && sessionId ? { name, value: sessionId } : undefined,
  };
}

describe("Home (root page) — anonymous visitor", () => {
  it("renders the public welcome screen with system statistics instead of redirecting", async () => {
    cookiesMock.mockResolvedValue(cookieJar());

    render(await Home());

    const welcome = screen.getByTestId("public-welcome");
    const stats = JSON.parse(welcome.dataset.stats ?? "{}") as Record<string, unknown>;
    expect(Object.keys(stats).sort()).toEqual(["totalTasks", "totalUsers"]);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("renders the welcome screen for an unknown/expired session id", async () => {
    cookiesMock.mockResolvedValue(cookieJar("does-not-exist"));

    render(await Home());

    expect(screen.getByTestId("public-welcome")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("does-not-exist");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("Home (root page) — authenticated visitor", () => {
  it("redirects to /dashboard instead of rendering the welcome screen", async () => {
    const session = await createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await Home();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
