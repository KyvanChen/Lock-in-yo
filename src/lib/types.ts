import type { MethodId } from "./methods";
import type { NoiseId } from "./scenes";

export type Category = "project" | "homework" | "study" | "personal";

/** 0 = normal, 1 = high, 2 = urgent. */
export type Priority = 0 | 1 | 2;

export interface Task {
  id: string;
  title: string;
  notes: string;
  category: Category;
  /** Class, subject, or project this belongs to. */
  course: string;
  /** ISO timestamp, or null when there is no deadline. */
  due_at: string | null;
  priority: Priority;
  /** Planned working time in minutes. */
  estimate_min: number | null;
  done: boolean;
  completed_at: string | null;
  /** Seconds of focus logged against this task. */
  focus_sec: number;
  created_at: string;
  updated_at: string;
  /** Soft delete, so removals propagate to other devices. */
  deleted_at: string | null;
}

export interface Session {
  id: string;
  task_id: string | null;
  /** Snapshot of the task title, so stats survive task deletion. */
  label: string;
  started_at: string;
  duration_sec: number;
  kind: "focus" | "break";
  /** Route flown, as "SFO-LAX", when the block ran in flight mode. */
  route: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** A bubble on the brainstorm canvas. */
export interface Idea {
  id: string;
  text: string;
  /** Null for a root bubble; otherwise the bubble it branches from. */
  parent_id: string | null;
  /** Index into IDEA_COLORS. */
  color: number;
  /** Last resting position, so a board reopens roughly as you left it. */
  x: number;
  y: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const IDEA_COLORS = [
  "var(--blue)",
  "var(--purple)",
  "var(--teal)",
  "var(--orange)",
  "var(--pink)",
  "var(--green)",
  "var(--indigo)",
];

export interface Settings {
  method: MethodId;
  focus_min: number;
  short_break_min: number;
  long_break_min: number;
  rounds_before_long: number;
  auto_start_breaks: boolean;
  chime: boolean;
  daily_goal_min: number;
  /** Run focus blocks as a flight. */
  flight_mode: boolean;
  /** Hide the destination until touchdown. */
  flight_blind: boolean;
  /** Id from VIDEO_SCENES, or null for no video. */
  scene: string | null;
  noise: NoiseId | null;
  noise_volume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  method: "pomodoro",
  focus_min: 25,
  short_break_min: 5,
  long_break_min: 20,
  rounds_before_long: 4,
  auto_start_breaks: true,
  chime: true,
  daily_goal_min: 120,
  flight_mode: false,
  flight_blind: true,
  scene: null,
  noise: null,
  noise_volume: 0.35,
};

export const CATEGORIES: {
  id: Category;
  label: string;
  color: string;
}[] = [
  { id: "homework", label: "Homework", color: "var(--orange)" },
  { id: "study", label: "Studying", color: "var(--indigo)" },
  { id: "project", label: "Projects", color: "var(--teal)" },
  { id: "personal", label: "Personal", color: "var(--pink)" },
];

export const CATEGORY_META: Record<Category, { label: string; color: string }> =
  Object.fromEntries(
    CATEGORIES.map((c) => [c.id, { label: c.label, color: c.color }]),
  ) as Record<Category, { label: string; color: string }>;

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; short: string }
> = {
  0: { label: "Normal", color: "var(--label-tertiary)", short: "" },
  1: { label: "High", color: "var(--orange)", short: "!" },
  2: { label: "Urgent", color: "var(--red)", short: "!!" },
};
