"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import type { Settings } from "@/entities/user/schema";
import { applyDocumentTheme } from "@/features/settings/apply-theme";
import { useSettings } from "@/features/settings/use-settings";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { NotificationsSection } from "./notifications-section";
import {
  settingsFormSchema,
  toFormValues,
  toSettingsPatch,
  type SettingsFormValues,
} from "./settings-form-schema";
import { TaskDefaultsSection } from "./task-defaults-section";
import { ThemeSection } from "./theme-section";
import { WorkDaySection } from "./work-day-section";

interface SettingsFormProps {
  initialSettings: Settings;
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const { updateSettings, isPending, error } = useSettings();
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(initialSettings);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    mode: "onSubmit",
    defaultValues: toFormValues(initialSettings),
  });

  const onValid = useCallback(
    async (values: SettingsFormValues) => {
      if (isPending) {
        return;
      }
      setSaved(false);
      const patch = toSettingsPatch(baseline, values);
      if (!patch) {
        return;
      }
      const result = await updateSettings(patch);
      if (result) {
        applyDocumentTheme(result.theme);
        reset(toFormValues(result));
        setBaseline(result);
        setSaved(true);
      }
    },
    [baseline, isPending, reset, updateSettings],
  );

  return (
    <Card className="w-full max-w-2xl" data-testid="settings-form">
      <CardContent>
        <form noValidate onSubmit={handleSubmit(onValid)} className="flex flex-col gap-8">
          <ThemeSection register={register} errors={errors} disabled={isPending} />
          <NotificationsSection control={control} disabled={isPending} />
          <WorkDaySection register={register} errors={errors} disabled={isPending} />
          <TaskDefaultsSection register={register} errors={errors} disabled={isPending} />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {saved && !error && !isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Настройки сохранены
            </p>
          )}

          <Button type="submit" disabled={isPending} className="self-start">
            {isPending ? (
              <>
                <Loader2Icon className="animate-spin" aria-hidden="true" />
                Сохранение...
              </>
            ) : (
              "Сохранить"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
