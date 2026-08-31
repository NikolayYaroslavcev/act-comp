import { countUsers } from "@/entities/user/repository";
import { countTasks } from "@/entities/task/repository";

export interface SystemStats {
  totalUsers: number;
  totalTasks: number;
}

export async function getSystemStats(): Promise<SystemStats> {
  return {
    totalUsers: await countUsers(),
    totalTasks: await countTasks(),
  };
}
