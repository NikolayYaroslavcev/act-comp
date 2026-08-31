import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemStatsSummary } from "./system-stats-summary";

describe("SystemStatsSummary", () => {
  it("publishes total users and total tasks as system statistics", () => {
    render(<SystemStatsSummary stats={{ totalUsers: 3, totalTasks: 13 }} />);

    expect(screen.getByRole("region", { name: "Статистика системы" })).toBeInTheDocument();
    expect(screen.getByText("Пользователей")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Задач")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  it("renders a compact inline summary when requested", () => {
    render(<SystemStatsSummary variant="compact" stats={{ totalUsers: 3, totalTasks: 13 }} />);

    expect(screen.queryByRole("region", { name: "Статистика системы" })).not.toBeInTheDocument();
    expect(screen.getByText("Пользователей:")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Задач:")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
  });
});
