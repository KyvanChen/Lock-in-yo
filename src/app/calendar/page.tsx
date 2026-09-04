"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { CATEGORY_META, type Task } from "@/lib/types";
import { addDays, dayKey, startOfDay } from "@/lib/date";
import { TaskEditor } from "@/components/TaskEditor";
import { PageHeader } from "@/components/PageHeader";
import { useTaskDrag } from "@/components/calendar/useTaskDrag";
import { Button, Segmented, cx } from "@/components/ui";
import { ChevronIcon, PlusIcon } from "@/components/icons";

const WEEKDAY_SHORT = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const WEEKDAY_NARROW = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
const DAY_NUM = new Intl.DateTimeFormat(undefined, { day: "numeric" });
const RANGE = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
});
const MONTH_YEAR = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

type Mode = "week" | "month";

/** Monday-start week containing the given date. */
function weekStart(d: Date): Date {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

/** "2026-09-15" back to a Date at the end of that local day. */
function endOfDayFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 0, 0);
}

export default function CalendarPage() {
  const { tasks, updateTask } = useData();
  const [mode, setMode] = useState<Mode>("week");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newDue, setNewDue] = useState<string | null>(null);
  const [justMoved, setJustMoved] = useState<string | null>(null);

  const openEdit = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      setNewDue(null);
      setEditing(task);
      setEditorOpen(true);
    },
    [tasks],
  );

  /** Dropping on a day sets the deadline to the end of that day. */
  const handleDrop = useCallback(
    (taskId: string, key: string) => {
      updateTask(taskId, { due_at: endOfDayFromKey(key).toISOString() });
      setJustMoved(taskId);
      window.setTimeout(() => setJustMoved(null), 1200);
    },
    [updateTask],
  );

  const { bind, ghost, hoverKey } = useTaskDrag({
    onDrop: handleDrop,
    onTap: openEdit,
  });

  /** Tasks bucketed by the local day they're due. */
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_at) continue;
      const key = dayKey(t.due_at);
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.priority !== b.priority) return b.priority - a.priority;
        return (a.due_at ?? "") < (b.due_at ?? "") ? -1 : 1;
      });
    }
    return map;
  }, [tasks]);

  const unscheduled = useMemo(
    () => tasks.filter((t) => !t.due_at && !t.done),
    [tasks],
  );

  const todayKey = dayKey(new Date());

  const weekDays = useMemo(() => {
    const start = addDays(weekStart(new Date()), offset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [offset]);

  const month = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    // Six rows always, so the grid height never jumps between months.
    return { first, cells: Array.from({ length: 42 }, (_, i) => addDays(weekStart(first), i)) };
  }, [offset]);

  const openNew = (day: Date) => {
    const at = new Date(day);
    at.setHours(23, 59, 0, 0);
    setNewDue(at.toISOString());
    setEditing(null);
    setEditorOpen(true);
  };

  const subtitle =
    mode === "week"
      ? `${RANGE.format(weekDays[0])} – ${RANGE.format(weekDays[6])}`
      : MONTH_YEAR.format(month.first);

  const chip = (task: Task, compact: boolean) => (
    <TaskChip
      key={task.id}
      task={task}
      compact={compact}
      moved={justMoved === task.id}
      {...bind(task, CATEGORY_META[task.category].color)}
    />
  );

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 md:pb-10">
      <PageHeader
        title="Calendar"
        subtitle={subtitle}
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={() => setOffset((o) => o - 1)}
              aria-label={mode === "week" ? "Previous week" : "Previous month"}
            >
              <ChevronIcon className="rotate-180 text-[16px]" />
            </Button>
            <Button size="sm" onClick={() => setOffset(0)} disabled={offset === 0}>
              Today
            </Button>
            <Button
              size="sm"
              onClick={() => setOffset((o) => o + 1)}
              aria-label={mode === "week" ? "Next week" : "Next month"}
            >
              <ChevronIcon className="text-[16px]" />
            </Button>
          </div>
        }
      />

      <div className="mb-4 max-w-[280px]">
        <Segmented
          label="Calendar range"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setOffset(0);
          }}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
      </div>

      {mode === "week" ? (
        /* Seven columns only once there is real room for them; below that the
           days wrap rather than squeezing to an unreadable width. */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {weekDays.map((day) => {
            const key = dayKey(day);
            const list = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            const isTarget = hoverKey === key;

            return (
              <section
                key={key}
                data-day={key}
                className="flex flex-col rounded-card p-2.5 transition-colors"
                style={{
                  background: isTarget
                    ? "color-mix(in srgb, var(--blue) 16%, var(--grouped-secondary))"
                    : "var(--grouped-secondary)",
                  boxShadow: isTarget
                    ? "inset 0 0 0 2px var(--blue)"
                    : isToday
                      ? "inset 0 0 0 2px var(--blue)"
                      : undefined,
                }}
              >
                <header className="mb-2 flex items-center justify-between gap-1 px-1">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      className={cx(
                        "text-footnote font-semibold uppercase tracking-[0.06em]",
                        isToday ? "text-blue" : "text-label-secondary",
                      )}
                    >
                      {WEEKDAY_SHORT.format(day)}
                    </span>
                    <span
                      className={cx(
                        "text-callout",
                        isToday ? "font-bold text-blue" : "text-label-tertiary",
                      )}
                    >
                      {DAY_NUM.format(day)}
                    </span>
                  </span>
                  <button
                    onClick={() => openNew(day)}
                    aria-label={`Add a task due ${WEEKDAY_SHORT.format(day)} ${DAY_NUM.format(day)}`}
                    className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] text-label-tertiary transition active:scale-90"
                    style={{ background: "var(--fill-quaternary)" }}
                  >
                    <PlusIcon />
                  </button>
                </header>

                <div className="flex min-h-[44px] flex-col gap-1.5">
                  {list.length === 0 && (
                    <p className="px-1 py-3 text-caption text-label-tertiary">
                      {isTarget ? "Drop to set this date" : "Clear"}
                    </p>
                  )}
                  {list.map((t) => chip(t, false))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="mb-1.5 grid grid-cols-7 gap-1.5">
            {month.cells.slice(0, 7).map((d) => (
              <div
                key={d.toISOString()}
                className="text-center text-caption2 font-semibold uppercase tracking-[0.06em] text-label-tertiary"
              >
                <span className="hidden sm:inline">{WEEKDAY_SHORT.format(d)}</span>
                <span className="sm:hidden">{WEEKDAY_NARROW.format(d)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {month.cells.map((day) => {
              const key = dayKey(day);
              const list = byDay.get(key) ?? [];
              const isToday = key === todayKey;
              const isTarget = hoverKey === key;
              const outside = day.getMonth() !== month.first.getMonth();
              const shown = list.slice(0, 2);
              const extra = list.length - shown.length;

              return (
                <div
                  key={key}
                  data-day={key}
                  className="flex min-h-[92px] flex-col gap-1 rounded-[10px] p-1.5 transition-colors sm:min-h-[112px]"
                  style={{
                    background: isTarget
                      ? "color-mix(in srgb, var(--blue) 20%, var(--grouped-secondary))"
                      : outside
                        ? "var(--fill-quaternary)"
                        : "var(--grouped-secondary)",
                    opacity: outside && !isTarget ? 0.55 : 1,
                    boxShadow:
                      isTarget || isToday ? "inset 0 0 0 2px var(--blue)" : undefined,
                  }}
                >
                  <button
                    onClick={() => openNew(day)}
                    aria-label={`Add a task due ${day.toDateString()}`}
                    className={cx(
                      "press self-start rounded-full px-1.5 text-caption transition",
                      isToday ? "font-bold text-blue" : "text-label-tertiary",
                    )}
                  >
                    {DAY_NUM.format(day)}
                  </button>

                  {shown.map((t) => chip(t, true))}

                  {extra > 0 && (
                    <span className="px-1 text-caption2 text-label-tertiary">
                      +{extra} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* The unscheduled tray. Drag anything here onto a day to give it a
          deadline — the whole reason the grid is always rendered, even when
          nothing has a date yet. */}
      <section className="mt-6">
        <h2 className="mb-2 px-1 text-footnote font-semibold uppercase tracking-[0.06em] text-label-secondary">
          No date yet · {unscheduled.length}
        </h2>
        {unscheduled.length === 0 ? (
          <p className="px-1 text-footnote text-label-secondary">
            Everything with a deadline is on the calendar.{" "}
            <Link href="/" className="text-blue">
              Add a task
            </Link>{" "}
            or{" "}
            <Link href="/import" className="text-blue">
              import your school calendar
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mb-2.5 px-1 text-footnote text-label-secondary">
              Drag one onto a day to set its due date. Tap to open it instead.
            </p>
            <div className="flex flex-wrap gap-2">
              {unscheduled.map((task) => (
                <button
                  key={task.id}
                  {...bind(task, CATEGORY_META[task.category].color)}
                  className="press touch-none cursor-grab rounded-full px-3 py-2 text-footnote transition active:cursor-grabbing"
                  style={{
                    background: `color-mix(in srgb, ${CATEGORY_META[task.category].color} 13%, transparent)`,
                  }}
                >
                  {task.title}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Follows the pointer so there is always something under your finger. */}
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 max-w-[220px] truncate rounded-full px-3 py-2 text-footnote font-medium"
          style={{
            left: ghost.x,
            top: ghost.y,
            transform: "translate(-50%, -140%)",
            background: `color-mix(in srgb, ${ghost.color} 90%, black)`,
            color: "#fff",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {ghost.title}
        </div>
      )}

      <TaskEditor
        open={editorOpen}
        task={editing}
        defaultDue={newDue}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TaskChip({
  task,
  compact,
  moved,
  ...handlers
}: {
  task: Task;
  compact: boolean;
  moved: boolean;
} & React.ComponentProps<"button">) {
  return (
    <button
      {...handlers}
      className="press w-full touch-none cursor-grab rounded-[8px] px-1.5 py-1 text-left transition active:cursor-grabbing"
      style={{
        background: `color-mix(in srgb, ${CATEGORY_META[task.category].color} ${task.done ? 6 : 13}%, transparent)`,
        // A brief ring confirms where a dropped task landed.
        boxShadow: moved
          ? `0 0 0 2px ${CATEGORY_META[task.category].color}`
          : undefined,
      }}
    >
      <span
        className={cx(
          "block",
          compact ? "truncate text-caption" : "line-clamp-3 text-footnote",
          task.done && "text-label-tertiary line-through",
        )}
      >
        {task.title}
      </span>
      {!compact && task.course && (
        <span className="mt-0.5 block truncate text-caption2 text-label-secondary">
          {task.course}
        </span>
      )}
    </button>
  );
}
