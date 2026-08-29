import type { PublicUser } from "@/entities/user/dto";
import type { SystemStats } from "@/features/dashboard/system-stats";

interface WelcomeScreenProps {
  user: PublicUser;
  stats: SystemStats;
}

export function WelcomeScreen({ user, stats }: WelcomeScreenProps) {
  return (
    <div
      data-testid="welcome-screen"
      className="motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8"
    >
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Добро пожаловать!</h1>
        <p className="text-sm text-muted-foreground">Вы вошли как {user.email}</p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-muted/50 px-3 py-4">
          <dt className="text-xs text-muted-foreground">Пользователей в системе</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{stats.totalUsers}</dd>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-4">
          <dt className="text-xs text-muted-foreground">Задач в системе</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{stats.totalTasks}</dd>
        </div>
      </dl>
    </div>
  );
}
