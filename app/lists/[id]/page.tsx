import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/features/auth/current-session";
import { SESSION_COOKIE_NAME } from "@/features/auth/session-cookie";
import { getVisibleList } from "@/features/list/get-list";
import { listVisibleTasks } from "@/features/task/list-tasks";
import { ListDetail } from "@/widgets/list/list-detail";

type ListDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListDetailPage({ params }: ListDetailPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const current = getCurrentSession(sessionId);

  if (!current) {
    return redirect("/login");
  }

  const result = getVisibleList(current.user.id, id);
  if (result.status === "not_found") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/40 px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground" data-testid="list-not-found">
          Список не найден или у вас нет к нему доступа.
        </p>
        <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Вернуться к спискам
        </Link>
      </div>
    );
  }

  const tasks = listVisibleTasks(current.user.id, id);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-muted/40 px-4 py-12">
      <div className="w-full max-w-5xl">
        <Link
          href="/dashboard"
          className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← К спискам
        </Link>
        <ListDetail list={result.list} tasks={tasks} currentUserId={current.user.id} />
      </div>
    </div>
  );
}
