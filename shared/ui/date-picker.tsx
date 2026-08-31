"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function timeFromDate(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function applyTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
  return next;
}

interface DatePickerProps {
  id?: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
  includeTime?: boolean;
  placeholder?: string;
  "data-testid"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-busy"?: boolean;
}

export function DatePicker({
  id,
  value,
  onChange,
  disabled,
  includeTime = false,
  placeholder = "Выберите дату",
  "data-testid": testId,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-busy": ariaBusy,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const timeId = id ? `${id}-time` : undefined;

  function handleSelect(next: Date | undefined) {
    if (!next) {
      onChange(null);
      return;
    }
    onChange(includeTime && value ? applyTime(next, timeFromDate(value)) : next);
    if (!includeTime) {
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        data-testid={testId}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-busy={ariaBusy}
        className={cn(
          "flex h-8 w-full cursor-pointer items-center justify-start gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm font-normal shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          !value && "text-muted-foreground",
        )}
      >
        <CalendarIcon className="size-4 opacity-50" aria-hidden="true" />
        {value
          ? format(value, includeTime ? "d MMM yyyy, HH:mm" : "d MMM yyyy", { locale: ru })
          : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[60] w-auto">
        <Calendar
          mode="single"
          locale={ru}
          selected={value ?? undefined}
          defaultMonth={value ?? undefined}
          onSelect={handleSelect}
        />
        {includeTime && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <Label htmlFor={timeId} className="shrink-0 font-normal">
              Время
            </Label>
            <Input
              id={timeId}
              type="time"
              disabled={disabled}
              value={value ? timeFromDate(value) : "00:00"}
              onChange={(event) => {
                const base = value ?? new Date();
                onChange(applyTime(base, event.target.value));
              }}
            />
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || value === null}
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          Очистить
        </Button>
      </PopoverContent>
    </Popover>
  );
}
