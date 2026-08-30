"use client";

import { useState } from "react";
import { useData } from "@/lib/store";
import {
  CATEGORIES,
  PRIORITY_META,
  type Category,
  type Priority,
  type Task,
} from "@/lib/types";
import { fromLocalInput, toLocalInput } from "@/lib/date";
import { Button, Field, Sheet, cx, inputClass, inputStyle } from "./ui";
import { TrashIcon } from "./icons";

interface Draft {
  title: string;
  notes: string;
  category: Category;
  course: string;
  due: string;
  priority: Priority;
  estimate: string;
}

const blank = (category: Category): Draft => ({
  title: "",
  notes: "",
  category,
  course: "",
  due: "",
  priority: 0,
  estimate: "",
});

interface EditorProps {
  open: boolean;
  task: Task | null;
  defaultCategory?: Category;
  /** Pre-fills the due date for a new task, e.g. the day column you tapped. */
  defaultDue?: string | null;
  onClose: () => void;
}

/**
 * Mounting a fresh form per task is what resets the draft — no effect syncing
 * props into state, so an in-progress edit can never be clobbered by a rerender.
 */
export function TaskEditor(props: EditorProps) {
  if (!props.open) return null;
  return (
    <Editor
      {...props}
      key={props.task?.id ?? `new-${props.defaultDue ?? ""}-${props.defaultCategory}`}
    />
  );
}

function Editor({
  task,
  defaultCategory = "homework",
  defaultDue,
  onClose,
}: EditorProps) {
  const { addTask, updateTask, deleteTask, tasks } = useData();
  const [draft, setDraft] = useState<Draft>(() =>
    task
      ? {
          title: task.title,
          notes: task.notes,
          category: task.category,
          course: task.course,
          due: toLocalInput(task.due_at),
          priority: task.priority,
          estimate: task.estimate_min ? String(task.estimate_min) : "",
        }
      : { ...blank(defaultCategory), due: toLocalInput(defaultDue ?? null) },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Offer classes already in use, so the same subject is spelled one way.
  const courses = [...new Set(tasks.map((t) => t.course).filter(Boolean))];

  const save = () => {
    const title = draft.title.trim();
    if (!title) return;
    const payload = {
      title,
      notes: draft.notes.trim(),
      category: draft.category,
      course: draft.course.trim(),
      due_at: fromLocalInput(draft.due),
      priority: draft.priority,
      estimate_min: draft.estimate ? Number(draft.estimate) : null,
    };
    if (task) updateTask(task.id, payload);
    else addTask(payload);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      footer={
        <div className="flex gap-2">
          {task && (
            <Button
              variant={confirmDelete ? "destructive" : "tinted"}
              tint="var(--red)"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                deleteTask(task.id);
                onClose();
              }}
              aria-label={confirmDelete ? "Confirm delete" : "Delete task"}
            >
              <TrashIcon className="text-[18px]" />
              {confirmDelete && "Really delete"}
            </Button>
          )}
          <Button
            variant="filled"
            block
            onClick={save}
            disabled={!draft.title.trim()}
          >
            {task ? "Save changes" : "Add task"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Task">
          <input
            className={inputClass}
            style={inputStyle}
            value={draft.title}
            autoFocus
            placeholder="Problem set 4, questions 1-8"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
            }}
          />
        </Field>

        <Field label="Type">
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => {
              const active = draft.category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraft({ ...draft, category: c.id })}
                  className={cx(
                    "flex min-h-[44px] items-center gap-2 rounded-control px-3 text-callout transition",
                    active ? "font-semibold" : "font-medium",
                  )}
                  style={{
                    background: active
                      ? `color-mix(in srgb, ${c.color} 16%, transparent)`
                      : "var(--fill-quaternary)",
                    color: active ? c.color : "var(--label-secondary)",
                    boxShadow: active ? `inset 0 0 0 1.5px ${c.color}` : undefined,
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Class or project" hint="Groups related work together.">
          <input
            className={inputClass}
            style={inputStyle}
            value={draft.course}
            list="course-suggestions"
            placeholder="AP Bio"
            onChange={(e) => setDraft({ ...draft, course: e.target.value })}
          />
          <datalist id="course-suggestions">
            {courses.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due">
            <input
              type="datetime-local"
              className={inputClass}
              style={inputStyle}
              value={draft.due}
              onChange={(e) => setDraft({ ...draft, due: e.target.value })}
            />
          </Field>
          <Field label="Estimate" hint="Minutes">
            <input
              type="number"
              min={5}
              step={5}
              inputMode="numeric"
              className={inputClass}
              style={inputStyle}
              value={draft.estimate}
              placeholder="45"
              onChange={(e) => setDraft({ ...draft, estimate: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Priority">
          <div className="grid grid-cols-3 gap-2">
            {([0, 1, 2] as Priority[]).map((p) => {
              const meta = PRIORITY_META[p];
              const active = draft.priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraft({ ...draft, priority: p })}
                  className={cx(
                    "min-h-[44px] rounded-control px-3 text-callout transition",
                    active ? "font-semibold" : "font-medium",
                  )}
                  style={{
                    background: active
                      ? `color-mix(in srgb, ${meta.color} 16%, transparent)`
                      : "var(--fill-quaternary)",
                    color: active ? meta.color : "var(--label-secondary)",
                    boxShadow: active
                      ? `inset 0 0 0 1.5px ${meta.color}`
                      : undefined,
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            rows={3}
            className={cx(inputClass, "resize-y")}
            style={inputStyle}
            value={draft.notes}
            placeholder="Chapter 12, skip the starred questions"
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </Field>
      </div>
    </Sheet>
  );
}
