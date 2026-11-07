const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

/** How often a schedule trigger opens a problem. `day` is 0 for Sunday, as Date.getUTCDay counts. */
export type Cadence = { every: "day" } | { every: "week"; day?: number };

export const CADENCE_FORMS = "daily, weekly, or weekly on <day>";

/** Reads a schedule trigger's `when`, or null when it is not one of the forms canon runs. */
export function parseCadence(when: string): Cadence | null {
  const text = when.trim().toLowerCase();
  if (text === "daily") return { every: "day" };
  if (text === "weekly") return { every: "week" };
  const day = DAYS.indexOf(/^weekly on (\w+)$/.exec(text)?.[1] ?? "");
  return day < 0 ? null : { every: "week", day };
}

/** Whether a schedule is due on `today` (YYYY-MM-DD, UTC), given the date it last opened a problem. */
export function isDue(cadence: Cadence, last: string | undefined, today: string): boolean {
  if (!last) return true;
  if (cadence.every === "day") return last < today;
  if (cadence.day === undefined) return daysBetween(last, today) >= WEEK_DAYS;
  // A missed day still counts: due once from the most recent such day.
  return last < mostRecent(cadence.day, today);
}

function mostRecent(day: number, today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  const back = (date.getUTCDay() - day + WEEK_DAYS) % WEEK_DAYS;
  return new Date(date.getTime() - back * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
