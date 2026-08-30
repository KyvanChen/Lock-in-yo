"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/store";
import { CATEGORIES, type Category, type Task } from "@/lib/types";
import { daysUntil } from "@/lib/date";
import { TaskRow } from "@/components/TaskRow";
import { TaskEditor } from "@/components/TaskEditor";
import { Button, Divider, EmptyState, ListGroup, cx, inputClass, inputStyle } from "@/components/ui";
import { CalendarIcon, PlusIcon } from "@/components/icons";

type Bucket =
  | "Overdue"
  | "Today"
  | "Tomorrow"
  | "This week"
  | "Later"
  | "No date";

const ORDER: Bucket[] = [
  "Overdue",
  "Today",
  "Tomorrow",
  "This week",
  "Later",
  "No date",
];

function bucketFor(task: Task): Bucket {
  if (!task.due_at) return "No date";
  const d = daysUntil(task.due_at);
  if (d < 0) return "Overdue";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 7) return "This week";
  return "Later";
}

export default function PlannerPage() {
  const { tasks, addTask } = useData();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [quick, setQuick] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.category === filter)),
    [tasks, filter],
  );

  const groups = useMemo(() => {
    const open = visible.filter((t) => !t.done);
    const map = new Map<Bucket, Task[]>();
    for (const t of open) {
      const b = bucketFor(t);
      map.set(b, [...(map.get(b) ?? []), t]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.due_at && b.due_at && a.due_at !== b.due_at)
          return a.due_at < b.due_at ? -1 : 1;
        if (a.priority !== b.priority) return b.priority - a.priority;
        return a.created_at < b.created_at ? 1 : -1;
      });
    }
    return ORDER.filter((b) => map.has(b)).map(
      (b) => [b, map.get(b) as Task[]] as const,
    );
  }, [visible]);

  const done = useMemo(
    () =>
      visible
        .filter((t) => t.done)
        .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1)),
    [visible],
  );

  const openEditor = (task: Task | null) => {
    setEditing(task);
    setEditorOpen(true);
  };

  const submitQuick = () => {
    const title = quick.trim();
    if (!title) return;
    addTask({
      title,
      category: filter === "all" ? "homework" : filter,
    });
    setQuick("");
  };

  const todayCount = tasks.filter(
    (t) => !t.done && t.due_at && daysUntil(t.due_at) <= 0,
  ).length;

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-24 pt-6 md:pb-10 md:pt-10">
      <header className="mb-5">
        <h1 className="text-large-title font-bold tracking-[-0.02em]">Planner</h1>
        <p className="mt-0.5 text-subheadline text-label-secondary">
          {todayCount > 0
            ? `${todayCount} ${todayCount === 1 ? "thing" : "things"} due today or overdue.`
            : "Nothing overdue. Good place to be."}
        </p>
      </header>

      {/* Quick add — one line, no dialog, for the 80% case. */}
      <div className="mb-4 flex gap-2">
        <input
          className={inputClass}
          style={inputStyle}
          value={quick}
          placeholder="Add a task, then press Enter"
          aria-label="Quick add a task"
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitQuick();
          }}
        />
        <Button
          variant="filled"
          onClick={() => openEditor(null)}
          aria-label="Add a task with details"
          className="shrink-0"
        >
          <PlusIcon className="text-[20px]" />
        </Button>
      </div>

      {/* Category filter */}
      <div
        role="radiogroup"
        aria-label="Filter by type"
        className="hide-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4"
      >
        {[{ id: "all" as const, label: "All", color: "var(--blue)" }, ...CATEGORIES].map(
          (c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                role="radio"
                aria-checked={active}
                onClick={() => setFilter(c.id as Category | "all")}
                className={cx(
                  "min-h-[36px] shrink-0 rounded-full px-3.5 text-subheadline transition",
                  active ? "font-semibold" : "font-medium",
                )}
                style={{
                  background: active
                    ? `color-mix(in srgb, ${c.color} 16%, transparent)`
                    : "var(--fill-quaternary)",
                  color: active ? c.color : "var(--label-secondary)",
                }}
              >
                {c.label}
              </button>
            );
          },
        )}
      </div>

      {groups.length === 0 && done.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon />}
          title="Nothing here yet"
          message="Add your homework, readings, and project milestones. Anything with a deadline is worth writing down."
          action={
            <Button variant="filled" onClick={() => openEditor(null)}>
              <PlusIcon className="text-[18px]" />
              Add your first task
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([bucket, list]) => (
            <ListGroup
              key={bucket}
              header={
                <span
                  style={{
                    color: bucket === "Overdue" ? "var(--red)" : undefined,
                  }}
                >
                  {bucket} · {list.length}
                </span>
              }
            >
              {list.map((task, i) => (
                <div key={task.id}>
                  {i > 0 && <Divider />}
                  <TaskRow task={task} onEdit={openEditor} />
                </div>
              ))}
            </ListGroup>
          ))}

          {done.length > 0 && (
            <section>
              <button
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="mb-2 px-4 text-footnote font-semibold uppercase tracking-[0.06em] text-label-secondary"
              >
                Completed · {done.length} {showDone ? "▾" : "▸"}
              </button>
              {showDone && (
                <div
                  className="overflow-hidden rounded-card"
                  style={{ background: "var(--grouped-secondary)" }}
                >
                  {done.slice(0, 50).map((task, i) => (
                    <div key={task.id}>
                      {i > 0 && <Divider />}
                      <TaskRow task={task} onEdit={openEditor} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <TaskEditor
        open={editorOpen}
        task={editing}
        defaultCategory={filter === "all" ? "homework" : filter}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}
