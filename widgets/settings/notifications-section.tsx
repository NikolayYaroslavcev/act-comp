import { Controller, type Control } from "react-hook-form";
import type { SettingsFormValues } from "./settings-form-schema";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";

const FLAGS = [
  { name: "deadlineReminders", label: "Напоминания о дедлайнах" },
  { name: "timeThresholdAlerts", label: "Оповещения о порогах времени" },
  { name: "workHoursRecalculation", label: "Пересчёт при смене рабочих часов" },
  { name: "otherUserChanges", label: "Изменения других пользователей" },
] as const;

interface NotificationsSectionProps {
  control: Control<SettingsFormValues>;
  disabled: boolean;
}

export function NotificationsSection({ control, disabled }: NotificationsSectionProps) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="settings-notifications-heading">
      <h2 id="settings-notifications-heading" className="text-sm font-semibold">
        Уведомления
      </h2>
      <p className="text-xs text-muted-foreground">
        Пороги времени (75% / 90% / 100%) и напоминания о дедлайне списка (15 / 10 / 5 минут)
        доставляются в приложении, пока открыта вкладка.
      </p>
      <div className="flex flex-col gap-3">
        {FLAGS.map((flag) => (
          <div key={flag.name} className="flex items-center gap-2">
            <Controller
              control={control}
              name={`notifications.${flag.name}`}
              render={({ field }) => (
                <Checkbox
                  id={`settings-notification-${flag.name}`}
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                  disabled={disabled}
                />
              )}
            />
            <Label htmlFor={`settings-notification-${flag.name}`} className="font-normal">
              {flag.label}
            </Label>
          </div>
        ))}
      </div>
    </section>
  );
}
