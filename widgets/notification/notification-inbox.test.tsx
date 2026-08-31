import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationInbox } from "./notification-inbox";
import { useNotifications } from "@/features/notification/use-notifications";

const { dismiss } = vi.hoisted(() => ({ dismiss: vi.fn() }));

vi.mock("@/features/notification/use-notifications", () => ({
  useNotifications: vi.fn(() => ({
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
    dismiss,
    refresh: vi.fn(),
  })),
}));

const AUTO_DISMISS_MS = 8_000;

describe("NotificationInbox", () => {
  afterEach(() => {
    vi.useRealTimers();
    dismiss.mockClear();
  });

  it("renders a due notification and a dismiss control", async () => {
    const user = userEvent.setup();
    render(<NotificationInbox />);

    expect(screen.getByTestId("notification-inbox")).toBeInTheDocument();
    expect(screen.getByText("TEST-1: потрачено 75% времени")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Скрыть" }));
    expect(dismiss).toHaveBeenCalledWith("time_threshold:t1:75");
  });

  it("hides the toast after 8 seconds without acknowledging it", async () => {
    vi.useFakeTimers();
    render(<NotificationInbox />);

    expect(screen.getByTestId("notification-item")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_DISMISS_MS);
    });

    expect(screen.queryByTestId("notification-item")).not.toBeInTheDocument();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("does not auto-hide while the pointer is over the toast", async () => {
    vi.useFakeTimers();
    render(<NotificationInbox />);

    fireEvent.pointerEnter(screen.getByTestId("notification-item"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_DISMISS_MS);
    });
    expect(screen.getByTestId("notification-item")).toBeInTheDocument();
    expect(dismiss).not.toHaveBeenCalled();

    fireEvent.pointerLeave(screen.getByTestId("notification-item"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_DISMISS_MS);
    });
    expect(screen.queryByTestId("notification-item")).not.toBeInTheDocument();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("does not auto-hide while the close control is focused", async () => {
    vi.useFakeTimers();
    render(<NotificationInbox />);

    screen.getByRole("button", { name: "Скрыть" }).focus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_DISMISS_MS);
    });
    expect(screen.getByTestId("notification-item")).toBeInTheDocument();
    expect(dismiss).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Скрыть" }).blur();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_DISMISS_MS);
    });
    expect(screen.queryByTestId("notification-item")).not.toBeInTheDocument();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("does not enable cross-tab sync by default", () => {
    render(<NotificationInbox />);

    expect(useNotifications).toHaveBeenCalledWith({ crossTabSyncEnabled: false });
  });

  it("forwards crossTabSyncEnabled to useNotifications when the otherUserChanges setting is on", () => {
    render(<NotificationInbox crossTabSyncEnabled />);

    expect(useNotifications).toHaveBeenCalledWith({ crossTabSyncEnabled: true });
  });
});
