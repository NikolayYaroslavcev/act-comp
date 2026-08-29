import { countUsers } from "@/entities/user/repository";
import { countTasks } from "@/entities/task/repository";

export interface SystemStats {
  totalUsers: number;
  totalTasks: number;
}

export function getSystemStats(): SystemStats {
  return {
    totalUsers: countUsers(),
    totalTasks: countTasks(),
  };
}
