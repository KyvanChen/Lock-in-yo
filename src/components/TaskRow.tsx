"use client";

import { useRouter } from "next/navigation";
import { useData } from "@/lib/store";
import { useTimer } from "@/lib/timer";
import { CATEGORY_META, PRIORITY_META, type Task } from "@/lib/types";
import { daysUntil, formatDue, formatDuration } from "@/lib/date";
import { CheckIcon, TimerIcon } from "./icons";
import { cx } from "./ui";

export function TaskRow({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const { toggleTask } = useData();
  const { setTaskId, taskId } = useTimer();
  const router = useRouter();

  const cat = CATEGORY_META[task.category];
  const overdue = task.due_at && !task.done && daysUntil(task.due_at) < 0;
  const dueToday = task.due_at && !task.done && daysUntil(task.due_at) === 0;
  const isTarget = taskId === task.id;

  const meta: string[] = [];
  if (task.course) meta.push(task.course);
  if (task.estimate_min) meta.push(`${task.estimate_min}m planned`);
  if (task.focus_sec > 0) meta.push(`${formatDuration(task.focus_sec)} logged`);

  return (
    <div className="flex items-stretch">
      {/* Completion toggle, sized well past the 44pt minimum target. */}
      <button
        onClick={() => toggleTask(task.id)}
        aria-pressed={task.done}
        aria-label={
          task.done ? `Mark ${task.title} not done` : `Mark ${task.title} done`
        }
        className="flex w-[52px] shrink-0 items-center justify-center"
      >
        <span
          className={cx(
            "flex h-[24px] w-[24px] items-center justify-center rounded-full border-[1.75px] text-[13px] text-white transition",
            task.done && "border-transparent",
          )}
          style={{
            borderColor: task.done ? "transparent" : "var(--label-tertiary)",
            background: task.done ? "var(--green)" : "transparent",
          }}
        >
          {task.done && <CheckIcon />}
        </span>
      </button>

      <button
        onClick={() => onEdit(task)}
        className="flex min-h-[56px] flex-1 flex-col justify-center gap-0.5 py-2.5 pr-2 text-left"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={cx(
              "text-body",
              task.done && "text-label-tertiary line-through",
            )}
          >
            {task.title}
          </span>
          {task.priority > 0 && !task.done && (
            <span
              className="text-footnote font-bold"
              style={{ color: PRIORITY_META[task.priority].color }}
              aria-label={`${PRIORITY_META[task.priority].label} priority`}
            >
              {PRIORITY_META[task.priority].short}
            </span>
          )}
        </span>

        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-footnote text-label-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: cat.color }}
            />
            {cat.label}
          </span>
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
          {task.due_at && (
            <span
              /* Overdue is carried by the word as well as the color, so the
                 status does not depend on color alone. */
              className={cx((overdue || dueToday) && "font-semibold")}
              style={{
                color: overdue
                  ? "var(--red)"
                  : dueToday
                    ? "var(--orange)"
                    : undefined,
              }}
            >
              {overdue ? `Overdue · ${formatDue(task.due_at)}` : formatDue(task.due_at)}
            </span>
          )}
        </span>
      </button>

      {!task.done && (
        <button
          onClick={() => {
            setTaskId(task.id);
            router.push("/lockin");
          }}
          aria-label={`Focus on ${task.title}`}
          title="Focus on this"
          className="flex w-[48px] shrink-0 items-center justify-center text-[19px] transition active:scale-90"
          style={{ color: isTarget ? "var(--blue)" : "var(--label-tertiary)" }}
        >
          <TimerIcon />
        </button>
      )}
    </div>
  );
}
