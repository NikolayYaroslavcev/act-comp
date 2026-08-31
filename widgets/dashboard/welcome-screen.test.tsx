import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicUser } from "@/entities/user/dto";
import { WelcomeScreen } from "./welcome-screen";

const user: PublicUser = {
  id: "u1",
  email: "admin@example.com",
  settings: {
    theme: "system",
    workDayHours: 8,
    notifications: {
      deadlineReminders: true,
      timeThresholdAlerts: true,
      workHoursRecalculation: true,
      otherUserChanges: true,
    },
    taskDefaults: { priority: 3, category: null, estimatedMin: 60 },
  },
};

describe("WelcomeScreen", () => {
  it("greets the current user and shows the system statistics", () => {
    render(<WelcomeScreen user={user} stats={{ totalUsers: 3, totalTasks: 13 }} />);

    expect(screen.getByText(/admin@example\.com/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
  });

  it("respects prefers-reduced-motion by disabling the entrance animation", () => {
    render(<WelcomeScreen user={user} stats={{ totalUsers: 0, totalTasks: 0 }} />);

    expect(screen.getByTestId("welcome-screen").className).toContain("motion-reduce:animate-none");
  });
});
