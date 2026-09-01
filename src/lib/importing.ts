import type { CalEvent } from "./ics";
import { dayKey } from "./date";
import type { Category, Task } from "./types";

export interface ImportDraft {
  uid: string;
  include: boolean;
  title: string;
  course: string;
  category: Category;
  due: Date;
  allDay: boolean;
  /** Already in the planner under the same title and day. */
  duplicate: boolean;
  /** Came out of a repeating rule. */
  repeated: boolean;
}

/* -------------------------------------------------------------------------
   Guessing what kind of thing an event is
   ---------------------------------------------------------------------- */

/** School-calendar entries that aren't coursework — and never class names. */
const NON_WORK =
  /\b(no school|holiday|break|vacation|early release|late start|assembly|spirit|picture day|field trip|conference|practice|game|rehearsal|meeting|appointment|class period|homeroom|advisory|lunch)\b/i;

const RULES: { category: Category; words: RegExp }[] = [
  {
    category: "study",
    words:
      /\b(test|quiz|exam|midterm|final|assessment|review|study|vocab|flashcard|unit \d)\b/i,
  },
  {
    category: "project",
    words:
      /\b(project|essay|presentation|portfolio|lab report|research|paper|draft|proposal|capstone)\b/i,
  },
  {
    category: "homework",
    words:
      /\b(homework|hw|assignment|problem set|pset|worksheet|reading|packet|exercise|due|submit|turn in)\b/i,
  },
  {
    category: "personal",
    words: NON_WORK,
  },
];

export function guessCategory(text: string): Category {
  for (const rule of RULES) {
    if (rule.words.test(text)) return rule.category;
  }
  // School calendars are mostly coursework, so that is the safer default.
  return "homework";
}

/* -------------------------------------------------------------------------
   Pulling the class out of the title
   ---------------------------------------------------------------------- */

/**
 * Schoology and Google summaries usually carry the class in one of a few
 * shapes. Anything unrecognised leaves the course blank rather than inventing
 * one — a wrong class is worse than none, since it drives the grouping.
 */
export function splitCourse(summary: string, description = ""): {
  title: string;
  course: string;
} {
  // "Assignment name (AP Biology)"
  const parens = /^(.*?)\s*\(([^()]{2,40})\)\s*$/.exec(summary);
  if (parens && parens[1].trim()) {
    return { title: parens[1].trim(), course: parens[2].trim() };
  }

  // "AP Biology: Lab writeup" / "AP Bio - Lab 3".
  //
  // Only a colon or a plain hyphen counts. Em and en dashes are punctuation
  // inside a title far more often than they are a course separator, and
  // splitting on them turned "Research paper first draft — bring a printed
  // copy" into a class called "Research paper first draft".
  const lead = /^([^:\-]{2,40})\s*[:\-]\s+(.{3,})$/.exec(summary);
  if (lead) {
    const maybeCourse = lead[1].trim();
    const words = maybeCourse.split(/\s+/).length;
    // Real class names are short and nounlike: "AP Biology", "Calculus BC".
    const plausible =
      words <= 3 &&
      maybeCourse.length <= 28 &&
      !NON_WORK.test(maybeCourse) &&
      !/\b(read|write|complete|finish|study|submit|bring|watch|draft|review)\b/i.test(
        maybeCourse,
      );
    if (plausible) return { title: lead[2].trim(), course: maybeCourse };
  }

  // Schoology puts "Course: X" in the description on some feeds.
  const fromDesc = /(?:^|\n)\s*(?:course|class|section)\s*[:\-]\s*(.{2,40})/i.exec(
    description,
  );
  if (fromDesc) {
    return { title: summary.trim(), course: fromDesc[1].trim() };
  }

  return { title: summary.trim(), course: "" };
}

/* -------------------------------------------------------------------------
   Building the preview
   ---------------------------------------------------------------------- */

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Turns parsed events into editable rows, flagging any that already exist so
 * re-importing an updated feed doesn't double everything up. Matching is on
 * title plus due day rather than a stored feed id, which keeps the database
 * schema unchanged.
 */
export function buildDrafts(
  events: CalEvent[],
  existing: Task[],
): ImportDraft[] {
  const seen = new Set(
    existing.map((t) => `${normalize(t.title)}|${t.due_at ? dayKey(t.due_at) : ""}`),
  );
  const withinBatch = new Set<string>();

  const drafts: ImportDraft[] = [];
  for (const ev of events) {
    const { title, course } = splitCourse(ev.summary, ev.description);
    if (!title) continue;

    const fingerprint = `${normalize(title)}|${dayKey(ev.start)}`;
    if (withinBatch.has(fingerprint)) continue; // same event twice in one file
    withinBatch.add(fingerprint);

    const duplicate = seen.has(fingerprint);
    drafts.push({
      uid: ev.uid,
      include: !duplicate,
      title,
      course,
      category: guessCategory(`${ev.summary} ${ev.description}`),
      due: ev.start,
      allDay: ev.allDay,
      duplicate,
      repeated: ev.repeated,
    });
  }
  return drafts;
}

/**
 * An all-day item becomes due at the end of that day, which is what "due
 * Friday" actually means to a student. Timed events keep their time.
 */
export function dueTimestamp(draft: ImportDraft): string {
  const d = new Date(draft.due);
  if (draft.allDay) d.setHours(23, 59, 0, 0);
  return d.toISOString();
}
