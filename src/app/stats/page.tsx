"use client";

import { useMemo } from "react";
import { useData } from "@/lib/store";
import { CATEGORY_META } from "@/lib/types";
import { addDays, dayKey, formatDuration, startOfDay } from "@/lib/date";
import { EmptyState, ListGroup } from "@/components/ui";
import { ChartIcon, FlameIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
const DAYS = 14;

export default function StatsPage() {
  const { sessions, tasks, settings } = useData();

  const focus = useMemo(
    () => sessions.filter((s) => s.kind === "focus"),
    [sessions],
  );

  /** Seconds focused per local day. */
  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of focus) {
      const key = dayKey(s.started_at);
      map.set(key, (map.get(key) ?? 0) + s.duration_sec);
    }
    return map;
  }, [focus]);

  const recent = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: DAYS }, (_, i) => {
      const d = addDays(today, i - (DAYS - 1));
      return { date: d, seconds: perDay.get(dayKey(d)) ?? 0 };
    });
  }, [perDay]);

  const peak = Math.max(settings.daily_goal_min * 60, ...recent.map((r) => r.seconds));
  const goalPct = peak > 0 ? ((settings.daily_goal_min * 60) / peak) * 100 : 0;

  /** Consecutive days ending today (or yesterday) with any focus logged. */
  const streak = useMemo(() => {
    let n = 0;
    const today = startOfDay(new Date());
    // A streak survives today being empty until the day is actually over.
    let cursor = (perDay.get(dayKey(today)) ?? 0) > 0 ? today : addDays(today, -1);
    while ((perDay.get(dayKey(cursor)) ?? 0) > 0) {
      n += 1;
      cursor = addDays(cursor, -1);
    }
    return n;
  }, [perDay]);

  const weekSeconds = recent.slice(-7).reduce((s, r) => s + r.seconds, 0);
  const totalSeconds = focus.reduce((s, r) => s + r.duration_sec, 0);
  const doneCount = tasks.filter((t) => t.done).length;

  /** Focus split by class, largest first. */
  const byCourse = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of focus) {
      const task = tasks.find((t) => t.id === s.task_id);
      const key = task?.course?.trim() || "Unassigned";
      map.set(key, (map.get(key) ?? 0) + s.duration_sec);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [focus, tasks]);

  const flights = useMemo(
    () => focus.filter((s) => s.route).slice(0, 12),
    [focus],
  );

  const flightKm = useMemo(() => {
    // Only completed routes carry a distance worth reporting; approximate by
    // counting each logged route once at its session length.
    return flights.length;
  }, [flights]);

  if (focus.length === 0) {
    return (
      <div className="mx-auto max-w-[720px] px-4 pb-24 md:pb-10">
        <PageHeader title="Stats" />
        <EmptyState
          icon={<ChartIcon />}
          title="Nothing logged yet"
          message="Run a focus block on the Lock In tab and your time starts showing up here — by day, by class, and as a streak."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-24 md:pb-10">
      <PageHeader title="Stats" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Streak"
          value={`${streak}`}
          unit={streak === 1 ? "day" : "days"}
          icon={<FlameIcon />}
          tint="var(--orange)"
        />
        <Stat label="This week" value={formatDuration(weekSeconds)} />
        <Stat label="All time" value={formatDuration(totalSeconds)} />
        <Stat label="Tasks done" value={`${doneCount}`} />
      </div>

      {/* Last two weeks */}
      <section className="mb-6">
        <h2 className="mb-3 text-title3 font-bold">Last two weeks</h2>
        <div
          className="rounded-card p-4"
          style={{ background: "var(--grouped-secondary)" }}
        >
          {/* The goal line carries the same information as the bar colour, so
              the chart still reads for anyone who can't separate green from
              blue. HIG > Accessibility: convey information with more than
              colour alone. */}
          <div className="relative flex h-[132px] items-end gap-1.5">
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed"
              style={{
                bottom: `${goalPct}%`,
                borderColor: "var(--label-tertiary)",
              }}
              aria-hidden="true"
            />
            {recent.map((r) => {
              const pct = peak > 0 ? (r.seconds / peak) * 100 : 0;
              const hitGoal = r.seconds >= settings.daily_goal_min * 60;
              return (
                <div
                  key={r.date.toISOString()}
                  className="group flex h-full flex-1 items-end"
                  title={`${r.date.toDateString()}: ${formatDuration(r.seconds)}`}
                >
                  <div
                    className="w-full rounded-t-[5px] transition-all duration-500 group-hover:opacity-80"
                    style={{
                      height: `${Math.max(pct, r.seconds > 0 ? 4 : 1.5)}%`,
                      background:
                        r.seconds === 0
                          ? "var(--fill-tertiary)"
                          : hitGoal
                            ? "var(--green)"
                            : "var(--blue)",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {recent.map((r) => (
              <span
                key={r.date.toISOString()}
                className="flex-1 text-center text-caption2 text-label-tertiary"
              >
                {WEEKDAY.format(r.date)}
              </span>
            ))}
          </div>
          <p className="mt-3 text-footnote text-label-secondary">
            The dashed line is your {settings.daily_goal_min} minute daily goal.
            Bars that clear it turn green.
          </p>
        </div>
      </section>

      {/* By class */}
      <ListGroup header="Where the time went" className="mb-6">
        {byCourse.map(([course, seconds], i) => {
          const share = totalSeconds > 0 ? seconds / totalSeconds : 0;
          const task = tasks.find((t) => t.course === course);
          const color = task
            ? CATEGORY_META[task.category].color
            : "var(--label-tertiary)";
          return (
            <div
              key={course}
              className={i > 0 ? "border-t px-4 py-3" : "px-4 py-3"}
              style={i > 0 ? { borderColor: "var(--separator)" } : undefined}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-body">{course}</span>
                <span className="tnum shrink-0 text-subheadline text-label-secondary">
                  {formatDuration(seconds)} · {Math.round(share * 100)}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: "var(--fill-tertiary)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share * 100}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </ListGroup>

      {flights.length > 0 && (
        <ListGroup
          header={`Flight log · ${flightKm} ${flightKm === 1 ? "flight" : "flights"}`}
          footer="Routes you flew while focusing."
        >
          {flights.map((s, i) => (
            <div
              key={s.id}
              className={i > 0 ? "border-t px-4 py-3" : "px-4 py-3"}
              style={i > 0 ? { borderColor: "var(--separator)" } : undefined}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-rounded text-headline font-semibold tracking-[-0.01em]">
                  {s.route?.replace("-", " → ")}
                </span>
                <span className="tnum text-footnote text-label-secondary">
                  {formatDuration(s.duration_sec)}
                </span>
              </div>
              <p className="truncate text-footnote text-label-secondary">
                {s.label} · {new Date(s.started_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </ListGroup>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  icon,
  tint,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
  tint?: string;
}) {
  return (
    <div
      className="rounded-card p-3.5"
      style={{ background: "var(--grouped-secondary)" }}
    >
      <p className="flex items-center gap-1.5 text-caption uppercase tracking-[0.06em] text-label-tertiary">
        {icon && <span style={{ color: tint }}>{icon}</span>}
        {label}
      </p>
      <p className="tnum mt-1 text-title2 font-bold tracking-[-0.01em]">
        {value}
        {unit && (
          <span className="text-subheadline font-medium text-label-secondary">
            {" "}
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}
