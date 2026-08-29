import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HighlightedText } from "./highlighted-text";

describe("HighlightedText", () => {
  it("renders plain text with no query", () => {
    render(<HighlightedText text="Написать тесты" />);
    expect(screen.getByText("Написать тесты")).toBeInTheDocument();
  });

  it("wraps the matched portion in a mark element", () => {
    render(<HighlightedText text="Написать тесты" query="тесты" />);
    const mark = screen.getByText("тесты", { selector: "mark" });
    expect(mark.tagName).toBe("MARK");
  });

  it("still exposes the full text as one element's content", () => {
    render(
      <span data-testid="wrapper">
        <HighlightedText text="Написать тесты" query="тесты" />
      </span>,
    );
    expect(screen.getByTestId("wrapper")).toHaveTextContent("Написать тесты");
  });
});
