import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SettingsFormValues } from "./settings-form-schema";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

interface ThemeSectionProps {
  register: UseFormRegister<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  disabled: boolean;
}

export function ThemeSection({ register, errors, disabled }: ThemeSectionProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="settings-theme-heading">
      <h2 id="settings-theme-heading" className="text-sm font-semibold">
        Оформление
      </h2>
      <div className="space-y-1.5">
        <Label htmlFor="settings-theme">Тема</Label>
        <Select id="settings-theme" disabled={disabled} {...register("theme")}>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
          <option value="system">Системная</option>
        </Select>
        {errors.theme && (
          <p role="alert" className="text-sm text-destructive">
            Выберите светлую, тёмную или системную тему
          </p>
        )}
      </div>
    </section>
  );
}
