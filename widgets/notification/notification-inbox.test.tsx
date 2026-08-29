import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationInbox } from "./notification-inbox";

vi.mock("@/features/notification/use-notifications", () => ({
  useNotifications: () => ({
    notifications: [
      {
        key: "time_threshold:t1:75",
        kind: "time_threshold",
        entityType: "task",
        entityId: "t1",
        threshold: 75,
        title: "TEST-1: потрачено 75% времени",
        body: "По задаче «Настроить CI» использовано 75% оценки.",
      },
    ],
    error: null,
    dismiss: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("NotificationInbox", () => {
  it("renders a due notification and a dismiss control", async () => {
    const user = userEvent.setup();
    render(<NotificationInbox />);

    expect(screen.getByTestId("notification-inbox")).toBeInTheDocument();
    expect(screen.getByText("TEST-1: потрачено 75% времени")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Скрыть" }));
  });
});
