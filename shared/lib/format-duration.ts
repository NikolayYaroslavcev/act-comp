const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) {
    return "0m";
  }

  const safeMinutes = Math.max(0, Math.trunc(minutes));
  const days = Math.floor(safeMinutes / MINUTES_PER_DAY);
  const remainderAfterDays = safeMinutes % MINUTES_PER_DAY;
  const hours = Math.floor(remainderAfterDays / MINUTES_PER_HOUR);
  const remainingMinutes = remainderAfterDays % MINUTES_PER_HOUR;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(`${remainingMinutes}m`);
  }

  return parts.join(" ");
}
