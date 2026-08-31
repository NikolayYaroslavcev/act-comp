import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { chooseSelectOption } from "@/shared/test/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

function StatusSelect(props: { defaultValue?: string | null; disabled?: boolean }) {
  return (
    <Select defaultValue={props.defaultValue} disabled={props.disabled}>
      <SelectTrigger aria-label="Статус">
        <SelectValue placeholder="Выберите статус" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="new" label="Новая">
          Новая
        </SelectItem>
        <SelectItem value="in_progress" label="В процессе">
          В процессе
        </SelectItem>
        <SelectItem value="done" label="Готово">
          Готово
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function ControlledStatusSelect() {
  const [value, setValue] = React.useState("new");
  return (
    <Select value={value} onValueChange={(next) => next && setValue(next)}>
      <SelectTrigger aria-label="Статус">
        <SelectValue placeholder="Выберите статус" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="new" label="Новая">
          Новая
        </SelectItem>
        <SelectItem value="in_progress" label="В процессе">
          В процессе
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select / SelectValue label resolution", () => {
  it("resolves a raw value to its item label instead of showing the raw value", () => {
    render(<StatusSelect defaultValue="in_progress" />);
    const trigger = screen.getByRole("combobox", { name: "Статус" });
    expect(trigger).toHaveTextContent("В процессе");
    expect(trigger).not.toHaveTextContent("in_progress");
  });

  it("resolves a different value to its corresponding label", () => {
    render(<StatusSelect defaultValue="done" />);
    expect(screen.getByRole("combobox", { name: "Статус" })).toHaveTextContent("Готово");
  });

  it("shows the placeholder when no value is selected", () => {
    render(<StatusSelect defaultValue={null} />);
    expect(screen.getByRole("combobox", { name: "Статус" })).toHaveTextContent("Выберите статус");
  });

  it("updates the displayed label when the selected value changes", async () => {
    const user = userEvent.setup();
    render(<StatusSelect defaultValue="new" />);
    const trigger = screen.getByRole("combobox", { name: "Статус" });
    expect(trigger).toHaveTextContent("Новая");

    await chooseSelectOption(user, trigger, "Готово");

    expect(trigger).toHaveTextContent("Готово");
    expect(trigger).not.toHaveTextContent("Новая");
  });

  it("keeps the disabled state working", () => {
    render(<StatusSelect defaultValue="new" disabled />);
    expect(screen.getByRole("combobox", { name: "Статус" })).toBeDisabled();
  });

  it("resolves labels for controlled value + onValueChange consumers", async () => {
    const user = userEvent.setup();
    render(<ControlledStatusSelect />);
    const trigger = screen.getByRole("combobox", { name: "Статус" });
    expect(trigger).toHaveTextContent("Новая");

    await chooseSelectOption(user, trigger, "В процессе");

    expect(trigger).toHaveTextContent("В процессе");
  });
});
