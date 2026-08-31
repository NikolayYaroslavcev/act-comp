"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import type { z } from "zod";

import { loginInputSchema, type LoginInput } from "@/entities/auth/requests";

type LoginFormValues = z.input<typeof loginInputSchema>;
import { useLogin } from "@/features/auth/use-login";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface LoginFormProps {
  redirectTo: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const { login, isPending, error } = useLogin();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LoginFormValues, unknown, LoginInput>({
    resolver: zodResolver(loginInputSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = useCallback(
    async (values: LoginInput) => {
      if (isPending) {
        return;
      }
      const result = await login(values);
      if (result) {
        router.push(redirectTo);
      }
    },
    [isPending, login, redirectTo, router]
  );

  return (
    <div className="motion-reduce:animate-none animate-in fade-in zoom-in-95 slide-in-from-bottom-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm duration-500 ease-out sm:p-8">
      <div className="mb-6 space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Вход в Task Manager</h1>
        <p className="text-sm text-muted-foreground">
          Введите email и пароль, чтобы продолжить
        </p>
      </div>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            disabled={isPending}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            disabled={isPending}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <p id="password-error" role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="rememberMe"
            render={({ field }) => (
              <Checkbox
                id="rememberMe"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
          <Label htmlFor="rememberMe" className="font-normal">
            Запомнить меня
          </Label>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" aria-hidden="true" />
              Выполняется вход...
            </>
          ) : (
            "Войти"
          )}
        </Button>
      </form>
    </div>
  );
}
