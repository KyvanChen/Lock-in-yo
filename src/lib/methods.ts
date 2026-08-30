/**
 * Focus methods, with the honest provenance of each interval.
 *
 * Worth knowing: the famous 25 minutes was not derived from a study — Cirillo
 * arrived at it by trial and error in the late 1980s. What the evidence
 * actually supports is (a) short commitments lower the barrier to starting and
 * (b) brief diversions restore attention (Lleras, University of Illinois). So
 * the right block length is the one you will actually start.
 */
export type MethodId =
  | "pomodoro"
  | "5217"
  | "ultradian"
  | "flowtime"
  | "custom";

export interface FocusMethod {
  id: MethodId;
  name: string;
  tagline: string;
  detail: string;
  focus_min: number;
  short_break_min: number;
  long_break_min: number;
  rounds_before_long: number;
  /** Flowtime counts up instead of down. */
  countUp?: boolean;
  color: string;
}

export const METHODS: FocusMethod[] = [
  {
    id: "pomodoro",
    name: "Pomodoro",
    tagline: "25 on, 5 off",
    detail:
      "The default for a reason: 25 minutes is short enough that you can always talk yourself into starting. Long break every 4 rounds.",
    focus_min: 25,
    short_break_min: 5,
    long_break_min: 20,
    rounds_before_long: 4,
    color: "var(--red)",
  },
  {
    id: "5217",
    name: "52 / 17",
    tagline: "52 on, 17 off",
    detail:
      "From DeskTime's 2014 analysis of its most productive 10% of users, who naturally settled into this rhythm. Good for essays and problem sets that need a running start.",
    focus_min: 52,
    short_break_min: 17,
    long_break_min: 30,
    rounds_before_long: 3,
    color: "var(--orange)",
  },
  {
    id: "ultradian",
    name: "Deep work",
    tagline: "90 on, 20 off",
    detail:
      "Built around the ~90 minute ultradian cycle. Use it for the one hard thing a day that needs real depth — coding, proofs, studio work.",
    focus_min: 90,
    short_break_min: 20,
    long_break_min: 30,
    rounds_before_long: 2,
    color: "var(--indigo)",
  },
  {
    id: "flowtime",
    name: "Flowtime",
    tagline: "Count up, break when you drop",
    detail:
      "No timer pressure: work until focus actually breaks, then rest about a fifth of what you put in. Best when interruptions would cost you more than the structure gains.",
    focus_min: 0,
    short_break_min: 0,
    long_break_min: 0,
    rounds_before_long: 4,
    countUp: true,
    color: "var(--teal)",
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "Your numbers",
    detail: "Set the block and break lengths yourself.",
    focus_min: 30,
    short_break_min: 6,
    long_break_min: 20,
    rounds_before_long: 4,
    color: "var(--purple)",
  },
];

export const METHOD_BY_ID: Record<MethodId, FocusMethod> = Object.fromEntries(
  METHODS.map((m) => [m.id, m]),
) as Record<MethodId, FocusMethod>;

/** Flowtime break: roughly 5 minutes of rest per 25 minutes of work. */
export function flowtimeBreakSec(workedSec: number): number {
  return Math.max(180, Math.min(30 * 60, Math.round(workedSec / 5)));
}
