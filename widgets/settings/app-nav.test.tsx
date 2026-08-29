import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppNav } from "./app-nav";

describe("AppNav", () => {
  it("links to the dashboard and settings", () => {
    render(<AppNav />);

    expect(screen.getByRole("link", { name: "Списки" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Настройки" })).toHaveAttribute("href", "/settings");
  });
});
