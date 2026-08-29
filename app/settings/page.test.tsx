import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "@/entities/session/repository";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { findUserById } from "@/entities/user/repository";
import SettingsPage from "./page";

const redirectMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (target: string) => redirectMock(target),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("@/widgets/settings/settings-form", () => ({
  SettingsForm: ({ initialSettings }: { initialSettings: { theme: string } }) => (
    <div data-testid="settings-form" data-theme={initialSettings.theme} />
  ),
}));

function cookieJar(sessionId?: string) {
  return {
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && sessionId ? { name, value: sessionId } : undefined,
  };
}

describe("SettingsPage", () => {
  it("renders the current user's settings", async () => {
    const session = createSession({
      userId: "u2",
      ip: "192.0.2.5 (demo)",
      device: "Chrome on Windows",
      rememberMe: false,
    });
    cookiesMock.mockResolvedValue(cookieJar(session.id));

    render(await SettingsPage());

    expect(screen.getByTestId("settings-form")).toHaveAttribute(
      "data-theme",
      findUserById("u2")!.settings.theme,
    );
    expect(screen.getByRole("link", { name: "Настройки" })).toHaveAttribute("href", "/settings");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", async () => {
    cookiesMock.mockResolvedValue(cookieJar());

    await SettingsPage();

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
