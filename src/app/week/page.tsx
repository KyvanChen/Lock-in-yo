"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/store";
import { CATEGORY_META, type Task } from "@/lib/types";
import { addDays, dayKey, startOfDay } from "@/lib/date";
import { TaskEditor } from "@/components/TaskEditor";
import { Button, cx } from "@/components/ui";
import { ChevronIcon, PlusIcon } from "@/components/icons";

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const DAY_NUM = new Intl.DateTimeFormat(undefined, { day: "numeric" });
const RANGE = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
});

/** Monday-start week containing the given date. */
function weekStart(d: Date): Date {
  const x = startOfDay(d);
  const shift = (x.getDay() + 6) % 7;
  return addDays(x, -shift);
}

export default function WeekPage() {
  const { tasks } = useData();
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newDue, setNewDue] = useState<string | null>(null);

  const start = useMemo(
    () => addDays(weekStart(new Date()), offset * 7),
    [offset],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [start],
  );

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

  const openNew = (day: Date) => {
    const at = new Date(day);
    at.setHours(23, 59, 0, 0);
    setNewDue(at.toISOString());
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (task: Task) => {
    setNewDue(null);
    setEditing(task);
    setEditorOpen(true);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-6 md:pb-10 md:pt-10">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-large-title font-bold tracking-[-0.02em]">Week</h1>
          <p className="mt-0.5 text-subheadline text-label-secondary">
            {RANGE.format(start)} – {RANGE.format(addDays(start, 6))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Previous week"
          >
            <ChevronIcon className="rotate-180 text-[16px]" />
          </Button>
          <Button size="sm" onClick={() => setOffset(0)} disabled={offset === 0}>
            Today
          </Button>
          <Button
            size="sm"
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Next week"
          >
            <ChevronIcon className="text-[16px]" />
          </Button>
        </div>
      </header>

      {/* Seven columns only once there is real room for them; below that the
          days wrap rather than squeezing to an unreadable width. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day);
          const list = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          const openCount = list.filter((t) => !t.done).length;

          return (
            <section
              key={key}
              className="flex flex-col rounded-card p-2.5"
              style={{
                background: "var(--grouped-secondary)",
                boxShadow: isToday
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
                    {WEEKDAY.format(day)}
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
                  aria-label={`Add a task due ${WEEKDAY.format(day)} ${DAY_NUM.format(day)}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] text-label-tertiary transition active:scale-90"
                  style={{ background: "var(--fill-quaternary)" }}
                >
                  <PlusIcon />
                </button>
              </header>

              <div className="flex flex-col gap-1.5">
                {list.length === 0 && (
                  <p className="px-1 py-3 text-caption text-label-tertiary">
                    Clear
                  </p>
                )}
                {list.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => openEdit(task)}
                    className="rounded-[10px] px-2 py-1.5 text-left transition active:scale-[0.98]"
                    style={{
                      background: `color-mix(in srgb, ${CATEGORY_META[task.category].color} ${task.done ? 6 : 13}%, transparent)`,
                    }}
                  >
                    <span
                      className={cx(
                        "line-clamp-3 text-footnote",
                        task.done && "text-label-tertiary line-through",
                      )}
                    >
                      {task.title}
                    </span>
                    {task.course && (
                      <span className="mt-0.5 block truncate text-caption2 text-label-secondary">
                        {task.course}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {openCount > 2 && (
                <p className="mt-2 px-1 text-caption2 text-label-tertiary">
                  {openCount} open
                </p>
              )}
            </section>
          );
        })}
      </div>

      {unscheduled.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-footnote font-semibold uppercase tracking-[0.06em] text-label-secondary">
            No date yet · {unscheduled.length}
          </h2>
          <p className="mb-2.5 px-1 text-footnote text-label-secondary">
            Open one and give it a due date to drop it into the week.
          </p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((task) => (
              <button
                key={task.id}
                onClick={() => openEdit(task)}
                className="rounded-full px-3 py-2 text-footnote transition active:scale-[0.97]"
                style={{
                  background: `color-mix(in srgb, ${CATEGORY_META[task.category].color} 13%, transparent)`,
                }}
              >
                {task.title}
              </button>
            ))}
          </div>
        </section>
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
