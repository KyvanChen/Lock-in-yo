/** Local-midnight key for a date, e.g. "2026-08-30". Never UTC — a task due
 *  tonight should not jump to tomorrow for anyone east of Greenwich. */
export function dayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Whole days from today to the given date. Negative means overdue. */
export function daysUntil(iso: string): number {
  const today = startOfDay(new Date()).getTime();
  const then = startOfDay(new Date(iso)).getTime();
  return Math.round((then - today) / 86_400_000);
}

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const MONTH_DAY = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const TIME = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

/** "Today", "Tomorrow", "Thu", or "Sep 12" depending on distance. */
export function relativeDay(iso: string): string {
  const diff = daysUntil(iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff < 7) return WEEKDAY.format(new Date(iso));
  return MONTH_DAY.format(new Date(iso));
}

/** True when the ISO timestamp carries a meaningful time, not just a date. */
export function hasTime(iso: string): boolean {
  const d = new Date(iso);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

export function formatTime(iso: string): string {
  return TIME.format(new Date(iso));
}

export function formatDue(iso: string): string {
  const day = relativeDay(iso);
  return hasTime(iso) ? `${day} at ${formatTime(iso)}` : day;
}

/** "1h 25m", "45m", or "0m" — for durations shown as text. */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "25:00" — for the running timer. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Value for a datetime-local input, in local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
