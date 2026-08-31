import type { PublicUser } from "@/entities/user/dto";
import type { SystemStats } from "@/features/dashboard/system-stats";
import { SystemStatsSummary } from "@/widgets/welcome/system-stats-summary";

interface WelcomeScreenProps {
  user: PublicUser;
  stats: SystemStats;
}

export function WelcomeScreen({ user, stats }: WelcomeScreenProps) {
  return (
    <div
      data-testid="welcome-screen"
      className="motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out flex flex-wrap items-center gap-x-6 gap-y-2"
    >
      <p className="motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-1 duration-500 ease-out text-sm text-muted-foreground">
        Вы вошли как {user.email}
      </p>
      <SystemStatsSummary
        variant="compact"
        stats={stats}
        className="motion-reduce:animate-none animate-in fade-in slide-in-from-bottom-1 duration-500 delay-150 ease-out fill-mode-both"
      />
    </div>
  );
}
