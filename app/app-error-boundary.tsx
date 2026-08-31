"use client";

import type { ReactNode } from "react";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/ui/card";

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(_error, reset) => (
        <div role="alert" className="flex min-h-[50vh] items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Что-то пошло не так</CardTitle>
              <CardDescription>
                Произошла непредвиденная ошибка при отображении страницы. Попробуйте
                повторить действие.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button type="button" onClick={reset}>
                Попробовать снова
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
