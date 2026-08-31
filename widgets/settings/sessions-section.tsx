"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useLogoutAll } from "@/features/auth/use-logout-all";
import { useSessions } from "@/features/auth/use-sessions";
import { usePagedItems } from "@/shared/lib/use-paged-items";
import { formatDateTime } from "@/shared/lib/format-date";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { PaginationBar } from "@/shared/ui/pagination";
import { Separator } from "@/shared/ui/separator";

export function SessionsSection() {
  const router = useRouter();
  const { sessions, isLoading, error: loadError } = useSessions();
  const { page, setPage, totalPages, pageItems } = usePagedItems(sessions);
  const { logoutAll, isPending, error: logoutError } = useLogoutAll();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (isPending) {
      return;
    }
    const ok = await logoutAll();
    if (ok) {
      setConfirmOpen(false);
      setDone(true);
      router.push("/login");
    }
  }, [isPending, logoutAll, router]);

  return (
    <Card className="w-full max-w-2xl" data-testid="sessions-section">
      <CardHeader>
        <CardTitle>История входов</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            Загрузка истории входов...
          </p>
        )}

        {!isLoading && loadError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {loadError}
          </p>
        )}

        {!isLoading && !loadError && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">Нет записей о входах</p>
        )}

        {!isLoading && !loadError && sessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
              {pageItems.map((session) => (
                <li key={session.id} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatDateTime(session.createdAt)}</span>
                    {session.isCurrent && <Badge>Текущая</Badge>}
                    {session.revokedAt && !session.isCurrent && (
                      <Badge variant="muted">Завершена</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span>{session.device}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{session.ip}</span>
                  </p>
                </li>
              ))}
            </ul>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              data-testid="sessions-pagination"
            />
          </div>
        )}

        <Separator />

        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground">
            Завершит все активные сессии, включая текущую. Потребуется войти снова.
          </p>
          <Button
            type="button"
            variant="destructive"
            disabled={isLoading || isPending || done}
            onClick={() => setConfirmOpen(true)}
          >
            Выйти со всех устройств
          </Button>
          {done && (
            <p role="status" className="text-sm text-muted-foreground">
              Вы вышли со всех устройств
            </p>
          )}
        </div>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Выйти со всех устройств?</DialogTitle>
              <DialogDescription>
                Все активные сессии будут завершены, включая текущую. Потребуется войти снова.
              </DialogDescription>
            </DialogHeader>

            {logoutError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {logoutError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={() => setConfirmOpen(false)}>
                Отмена
              </Button>
              <Button type="button" variant="destructive" disabled={isPending} onClick={handleConfirm}>
                {isPending ? (
                  <>
                    <Loader2Icon className="animate-spin" aria-hidden="true" />
                    Завершение сессий...
                  </>
                ) : (
                  "Выйти везде"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
