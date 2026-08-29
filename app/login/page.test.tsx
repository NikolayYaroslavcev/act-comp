import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "@/entities/session/repository";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import LoginPage from "./page";

const redirectMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("@/features/auth/login-form", () => ({
  LoginForm: ({ redirectTo }: { redirectTo: string }) => (
    <div data-testid="login-form" data-redirect-to={redirectTo} />
  ),
}));

function cookieJar(sessionId?: string) {
  return {
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && sessionId ? { name, value: sessionId } : undefined,
  };
}

function searchParams(redirect?: string) {
  return Promise.resolve({ redirect });
}

describe("LoginPage — anonymous visitor", () => {
  it("renders the login form with the default redirect target when none was requested", async () => {
    cookiesMock.mockResolvedValue(cookieJar());

    render(await LoginPage({ searchParams: searchParams() }));

    expect(screen.getByTestId("login-form")).toHaveAttribute("data-redirect-to", "/dashboard");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("renders the login form with a valid internal redirect target", async () => {
    cookiesMock.mockResolvedValue(cookieJar());

    render(await LoginPage({ searchParams: searchParams("/lists/123?tab=done") }));

    expect(screen.getByTestId("login-form")).toHaveAttribute(
      "data-redirect-to",
      "/lists/123?tab=done"
    );
  });

  it("falls back to the default redirect target for an external redirect param", async () => {
    cookiesMock.mockResolvedValue(cookieJar());

    render(await LoginPage({ searchParams: searchParams("https://evil.com") }));

    expect(screen.getByTestId("login-form")).toHaveAttribute("data-redirect-to", "/dashboard");
  });

  it("falls back to the default redirect target for a malformed redirect param", async () => {
    cookiesMock.mockResolvedValue(cookieJar());

    render(await LoginPage({ searchParams: searchParams("not-a-path") }));

    expect(screen.getByTestId("login-form")).toHaveAttribute("data-redirect-to", "/dashboard");
  });
});

describe("LoginPage — already-authenticated visitor", () => {
  it("redirects to the default authenticated route instead of showing the form", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await LoginPage({ searchParams: searchParams() });

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to a valid internal redirect target instead of showing the form", async () => {
    const session = createSession({
      userId: "u1",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    await LoginPage({ searchParams: searchParams("/lists/123") });

    expect(redirectMock).toHaveBeenCalledWith("/lists/123");
  });
});
