import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicWelcome } from "./public-welcome";

describe("PublicWelcome", () => {
  it("shows a greeting heading and the system statistics", () => {
    render(<PublicWelcome stats={{ totalUsers: 3, totalTasks: 13 }} />);

    expect(screen.getByRole("heading", { level: 1, name: "Добро пожаловать" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Статистика системы" })).toBeInTheDocument();
    expect(screen.getByText("Пользователей")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Задач")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  it("does not add marketing copy beyond the welcome message required by the spec", () => {
    render(<PublicWelcome stats={{ totalUsers: 0, totalTasks: 0 }} />);

    expect(screen.queryByText(/войдите, чтобы/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/управляйте/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/канбан/i)).not.toBeInTheDocument();
  });

  it("links the login button to /login", () => {
    render(<PublicWelcome stats={{ totalUsers: 0, totalTasks: 0 }} />);

    expect(screen.getByRole("link", { name: /войти/i })).toHaveAttribute("href", "/login");
  });

  it("animates the welcome message and respects prefers-reduced-motion", () => {
    render(<PublicWelcome stats={{ totalUsers: 0, totalTasks: 0 }} />);

    const message = screen.getByTestId("welcome-message");
    expect(message.className).toContain("fade-in");
    expect(message.className).toContain("motion-reduce:animate-none");
  });

  it("does not expose a session id or private user data", () => {
    const { container } = render(<PublicWelcome stats={{ totalUsers: 3, totalTasks: 13 }} />);

    expect(container.innerHTML).not.toContain("session_id");
    expect(container.textContent).not.toMatch(/@example\.com/i);
    expect(container.textContent).not.toMatch(/session[_-]?id/i);
    expect(container.textContent).not.toMatch(/userId|password/i);
  });

  it("keeps the greeting and login CTA accessible in light and dark themes", () => {
    const { rerender } = render(
      <div className="light">
        <PublicWelcome stats={{ totalUsers: 1, totalTasks: 2 }} />
      </div>
    );

    expect(screen.getByRole("heading", { name: "Добро пожаловать" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /войти/i })).toBeInTheDocument();

    rerender(
      <div className="dark">
        <PublicWelcome stats={{ totalUsers: 1, totalTasks: 2 }} />
      </div>
    );

    expect(screen.getByRole("heading", { name: "Добро пожаловать" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /войти/i })).toBeEnabled();
  });
});
