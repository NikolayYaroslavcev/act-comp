import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./settings-form";
import { DEFAULT_SETTINGS, type Settings } from "@/entities/user/schema";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const initial: Settings = {
  ...DEFAULT_SETTINGS,
  theme: "light",
  workDayHours: 6,
  notifications: {
    deadlineReminders: true,
    timeThresholdAlerts: false,
    workHoursRecalculation: true,
    otherUserChanges: false,
  },
  taskDefaults: { priority: 2, category: "Personal", estimatedMin: 30 },
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
});

describe("SettingsForm", () => {
  it("renders the current settings values", () => {
    render(<SettingsForm initialSettings={initial} />);

    expect(screen.getByRole("combobox", { name: "Тема" })).toHaveValue("light");
    expect(screen.getByRole("spinbutton", { name: "Длительность рабочего дня (часы)" })).toHaveValue(6);
    expect(screen.getByRole("checkbox", { name: "Напоминания о дедлайнах" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Оповещения о порогах времени" })).not.toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Приоритет по умолчанию" })).toHaveValue(2);
    expect(screen.getByLabelText("Категория по умолчанию")).toHaveValue("Personal");
    expect(screen.getByRole("spinbutton", { name: "Оценка времени по умолчанию (мин)" })).toHaveValue(30);
  });

  it("saves only the changed theme field", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: { ...initial, theme: "dark" } })),
    );
    render(<SettingsForm initialSettings={initial} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Тема" }), "dark");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ theme: "dark" }),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Настройки сохранены");
  });

  it("shows a validation error for an invalid work day and does not submit", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());
    render(<SettingsForm initialSettings={initial} />);

    const input = screen.getByRole("spinbutton", { name: "Длительность рабочего дня (часы)" });
    await user.clear(input);
    await user.type(input, "30");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("disables controls while saving", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );
    render(<SettingsForm initialSettings={initial} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Тема" }), "dark");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByRole("button", { name: /сохранение/i })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Тема" })).toBeDisabled();

    resolveFetch(jsonResponse(200, { data: { ...initial, theme: "dark" } }));
    expect(await screen.findByRole("status")).toHaveTextContent("Настройки сохранены");
  });

  it("keeps entered values and shows an error when the server rejects the save", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: "x" } })));
    render(<SettingsForm initialSettings={initial} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Тема" }), "dark");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Проверьте правильность заполнения формы");
    expect(screen.getByRole("combobox", { name: "Тема" })).toHaveValue("dark");
  });

  it("applies the dark class after a successful theme save", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: { ...initial, theme: "dark" } })),
    );
    render(<SettingsForm initialSettings={initial} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Тема" }), "dark");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await screen.findByRole("status");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
