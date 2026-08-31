import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAppSelector } from "@/shared/store/hooks";
import { baseApi } from "@/shared/api/base-api";
import { StoreProvider } from "@/shared/store/provider";

function Probe() {
  const reducerPath = useAppSelector((state) => Object.keys(state).includes(baseApi.reducerPath));
  return <span data-testid="probe">{String(reducerPath)}</span>;
}

describe("StoreProvider", () => {
  it("renders its children", () => {
    render(
      <StoreProvider>
        <span data-testid="child">hello</span>
      </StoreProvider>,
    );

    expect(screen.getByTestId("child")).toHaveTextContent("hello");
  });

  it("provides a real store that a descendant hook can read from", () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("true");
  });
});
