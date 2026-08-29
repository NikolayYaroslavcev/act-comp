import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SettingsFormValues } from "./settings-form-schema";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface WorkDaySectionProps {
  register: UseFormRegister<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  disabled: boolean;
}

export function WorkDaySection({ register, errors, disabled }: WorkDaySectionProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="settings-workday-heading">
      <h2 id="settings-workday-heading" className="text-sm font-semibold">
        Рабочий день
      </h2>
      <div className="space-y-1.5">
        <Label htmlFor="settings-work-day-hours">Длительность рабочего дня (часы)</Label>
        <Input
          id="settings-work-day-hours"
          type="number"
          min={0.25}
          max={24}
          step="any"
          disabled={disabled}
          aria-invalid={errors.workDayHours ? true : undefined}
          aria-describedby={errors.workDayHours ? "settings-work-day-hours-error" : undefined}
          {...register("workDayHours", { valueAsNumber: true })}
        />
        {errors.workDayHours && (
          <p id="settings-work-day-hours-error" role="alert" className="text-sm text-destructive">
            Укажите число часов больше 0 и не больше 24
          </p>
        )}
      </div>
    </section>
  );
}
