import type { Activity } from "@/entities/activity/schema";

export interface TaskActivityItem extends Activity {
  actorEmail: string;
}
