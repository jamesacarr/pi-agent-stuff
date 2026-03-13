/** Format a Date as YYYY-MM-DD in local time. */
export const toLocalDayKey = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Return a new Date set to local midnight. */
export const localMidnight = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

/** Add (or subtract) days in local time, respecting DST. */
export const addDaysLocal = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Count days inclusive from start to end in local time.
 * Avoids ms-based arithmetic because DST transitions can make a "day" 23 or 25 hours.
 */
export const countDaysInclusive = (start: Date, end: Date): number => {
  let count = 0;
  for (let d = new Date(start); d <= end; d = addDaysLocal(d, 1)) {
    count++;
  }
  return count;
};

/** Monday-based weekday index: Mon=0 .. Sun=6. */
export const mondayIndex = (date: Date): number => (date.getDay() + 6) % 7;

/** Parse a session filename timestamp, e.g. "2026-02-02T21-52-28-774Z_<uuid>.jsonl". */
export const parseSessionStartFromFilename = (
  filename: string,
): Date | null => {
  const match = filename.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_/,
  );
  if (!match) {
    return null;
  }
  const iso = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
};
