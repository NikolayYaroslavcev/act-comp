import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { SettingsFormValues } from "./settings-form-schema";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface TaskDefaultsSectionProps {
  register: UseFormRegister<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  disabled: boolean;
}

export function TaskDefaultsSection({ register, errors, disabled }: TaskDefaultsSectionProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="settings-defaults-heading">
      <div className="space-y-1">
        <h2 id="settings-defaults-heading" className="text-sm font-semibold">
          Значения по умолчанию для новых задач
        </h2>
        <p className="text-xs text-muted-foreground">Применяются при создании новой задачи в любом списке.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-default-priority">Приоритет по умолчанию</Label>
          <Input
            id="settings-default-priority"
            type="number"
            min={1}
            max={5}
            step={1}
            disabled={disabled}
            aria-invalid={errors.taskDefaults?.priority ? true : undefined}
            aria-describedby={
              errors.taskDefaults?.priority ? "settings-default-priority-error" : undefined
            }
            {...register("taskDefaults.priority", { valueAsNumber: true })}
          />
          {errors.taskDefaults?.priority && (
            <p id="settings-default-priority-error" role="alert" className="text-sm text-destructive">
              Приоритет должен быть числом от 1 до 5
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-default-estimated">Оценка времени по умолчанию (мин)</Label>
          <Input
            id="settings-default-estimated"
            type="number"
            min={0}
            step={1}
            disabled={disabled}
            aria-invalid={errors.taskDefaults?.estimatedMin ? true : undefined}
            aria-describedby={
              errors.taskDefaults?.estimatedMin ? "settings-default-estimated-error" : undefined
            }
            {...register("taskDefaults.estimatedMin", { valueAsNumber: true })}
          />
          {errors.taskDefaults?.estimatedMin && (
            <p id="settings-default-estimated-error" role="alert" className="text-sm text-destructive">
              Оценка времени не может быть отрицательной
            </p>
          )}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="settings-default-category">Категория по умолчанию</Label>
          <Input
            id="settings-default-category"
            disabled={disabled}
            {...register("taskDefaults.category")}
          />
        </div>
      </div>
    </section>
  );
}
