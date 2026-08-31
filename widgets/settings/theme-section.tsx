import type { Control, FieldErrors } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { SettingsFormValues } from "./settings-form-schema";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

interface ThemeSectionProps {
  control: Control<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  disabled: boolean;
}

export function ThemeSection({ control, errors, disabled }: ThemeSectionProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="settings-theme-heading">
      <div className="space-y-1">
        <h2 id="settings-theme-heading" className="text-sm font-semibold">
          Оформление
        </h2>
        <p className="text-xs text-muted-foreground">Цветовая тема интерфейса.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-theme">Тема</Label>
        <Controller
          control={control}
          name="theme"
          render={({ field }) => (
            <Select
              items={{ light: "Светлая", dark: "Тёмная", system: "Системная" }}
              value={field.value}
              onValueChange={(value) => value && field.onChange(value)}
              disabled={disabled}
            >
              <SelectTrigger id="settings-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light" label="Светлая">Светлая</SelectItem>
                <SelectItem value="dark" label="Тёмная">Тёмная</SelectItem>
                <SelectItem value="system" label="Системная">Системная</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.theme && (
          <p role="alert" className="text-sm text-destructive">
            Выберите светлую, тёмную или системную тему
          </p>
        )}
      </div>
    </section>
  );
}
