import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./app-error-boundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("AppErrorBoundary", () => {
  it("renders children on the happy path", () => {
    render(
      <AppErrorBoundary>
        <p>dashboard content</p>
      </AppErrorBoundary>
    );

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });

  it("catches a render error and shows an accessible fallback using shared UI primitives", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <Bomb />
      </AppErrorBoundary>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /попробовать снова/i })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("lets the user retry after an error via the fallback's reset control", async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;

    function MaybeBomb() {
      if (shouldThrow) throw new Error("boom");
      return <p>recovered content</p>;
    }

    const { rerender } = render(
      <AppErrorBoundary>
        <MaybeBomb />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: /попробовать снова/i }));
    rerender(
      <AppErrorBoundary>
        <MaybeBomb />
      </AppErrorBoundary>
    );

    expect(screen.getByText("recovered content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
