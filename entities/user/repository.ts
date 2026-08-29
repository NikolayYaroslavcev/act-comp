import { getDb } from "@/shared/lib/db";
import type { User } from "@/entities/user/schema";

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.toLowerCase();
  return Object.values(getDb().users).find((user) => user.email.toLowerCase() === normalized);
}

export function findUserById(id: string): User | undefined {
  return getDb().users[id];
}

export function countUsers(): number {
  return Object.keys(getDb().users).length;
}
