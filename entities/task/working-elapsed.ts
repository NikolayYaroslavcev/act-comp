/**
 * Working elapsed between two instants, given only `workDayHours`.
 *
 * The current user model has no workStart, workEnd, weekdays, holidays, or
 * timezone. This function therefore does not invent a business calendar: it
 * counts wall-clock overlap with each UTC calendar day and caps that overlap
 * at `workDayHours * 60` minutes. Instants are interpreted as absolute UTC
 * (ISO timestamps in this app are stored with a `Z` offset).
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_UTC_DAY = 24 * MS_PER_HOUR;
const MAX_WORK_DAY_HOURS = 24;

export function calculateWorkingElapsedMs(
  start: Date | string | number,
  end: Date | string | number,
  workDayHours: number,
): number {
  if (!Number.isFinite(workDayHours) || workDayHours <= 0 || workDayHours > MAX_WORK_DAY_HOURS) {
    throw new RangeError("workDayHours must be a finite number greater than 0 and at most 24");
  }

  const startMs = toUtcMs(start);
  const endMs = toUtcMs(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }

  const capMs = workDayHours * MS_PER_HOUR;
  let totalMs = 0;
  let cursor = startMs;
  while (cursor < endMs) {
    const nextUtcMidnight = utcDayStartMs(cursor) + MS_PER_UTC_DAY;
    const sliceEnd = Math.min(endMs, nextUtcMidnight);
    totalMs += Math.min(sliceEnd - cursor, capMs);
    cursor = sliceEnd;
  }
  return totalMs;
}

export function calculateWorkingElapsedMinutes(
  start: Date | string | number,
  end: Date | string | number,
  workDayHours: number,
): number {
  return Math.floor(calculateWorkingElapsedMs(start, end, workDayHours) / MS_PER_MINUTE);
}

/**
 * The inverse of calculateWorkingElapsedMs: given a start instant and a
 * number of *working* minutes to add, returns the instant at which exactly
 * that many working minutes will have elapsed. Used for completion
 * prediction (projecting "N working minutes remain" onto a calendar date)
 * without introducing a second definition of what a working day is — this
 * walks the same per-UTC-day cap that calculateWorkingElapsedMs enforces,
 * just in the opposite direction. Every full day's wall-clock length (24h)
 * is at least the cap (<=24h), so within a day elapsed grows 1:1 with
 * wall-clock time up to the cap, then flatlines until the next UTC day.
 */
export function projectWorkingCompletionMs(
  start: Date | string | number,
  minutesToAdd: number,
  workDayHours: number,
): number {
  if (!Number.isFinite(workDayHours) || workDayHours <= 0 || workDayHours > MAX_WORK_DAY_HOURS) {
    throw new RangeError("workDayHours must be a finite number greater than 0 and at most 24");
  }

  const startMs = toUtcMs(start);
  let remainingMs = Number.isFinite(minutesToAdd) ? Math.max(0, minutesToAdd) * MS_PER_MINUTE : 0;
  const capMs = workDayHours * MS_PER_HOUR;
  let cursor = startMs;

  while (remainingMs > 0) {
    const nextUtcMidnight = utcDayStartMs(cursor) + MS_PER_UTC_DAY;
    const capacityToday = Math.min(nextUtcMidnight - cursor, capMs);
    if (remainingMs <= capacityToday) {
      cursor += remainingMs;
      remainingMs = 0;
    } else {
      remainingMs -= capacityToday;
      cursor = nextUtcMidnight;
    }
  }

  return cursor;
}

function toUtcMs(value: Date | string | number): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return value;
  }
  return Date.parse(value);
}

function utcDayStartMs(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
