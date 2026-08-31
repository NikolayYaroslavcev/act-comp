import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { getVisibleList } from "@/features/list/get-list";
import { getListHistoryForUser } from "@/features/list/list-history";
import { listVisibleTasks } from "@/features/task/list-tasks";
import { AppNav } from "@/widgets/settings/app-nav";
import { ListDetail } from "@/widgets/list/list-detail";

type ListDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListDetailPage({ params }: ListDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const current = await getCurrentSession(sessionId);

  if (!current) {
    return redirect("/login");
  }

  const result = await getVisibleList(current.user.id, id);
  if (result.status === "not_found") {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-muted/40">
        <AppNav active="dashboard" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground" data-testid="list-not-found">
            Список не найден или у вас нет к нему доступа.
          </p>
          <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Вернуться к спискам
          </Link>
        </div>
      </div>
    );
  }

  const tasks = await listVisibleTasks(current.user.id, id);
  const historyResult = await getListHistoryForUser(current.user.id, id);
  const history = historyResult.status === "ok" ? historyResult.history : [];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-muted/40">
      <AppNav active="dashboard" />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
          К спискам
        </Link>
        <ListDetail
          list={result.list}
          tasks={tasks}
          currentUserId={current.user.id}
          workDayHours={current.user.settings.workDayHours}
          otherUserChangesEnabled={current.user.settings.notifications.otherUserChanges}
          history={history}
        />
      </div>
    </div>
  );
}
