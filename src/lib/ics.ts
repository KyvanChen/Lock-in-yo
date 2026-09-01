/**
 * iCalendar (RFC 5545) parsing, plus a looser parser for text pasted straight
 * out of a calendar web page.
 *
 * Both Google Calendar and Schoology hand out .ics, so that is the path that
 * actually round-trips reliably. The plain-text parser is the fallback for
 * when someone selects a list of assignments and hits copy.
 */

export interface CalEvent {
  /** Stable id from the feed when there is one, else derived from the content. */
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: Date;
  end: Date | null;
  /** All-day events carry a date with no meaningful time. */
  allDay: boolean;
  /** Generated from an RRULE rather than written out in the file. */
  repeated: boolean;
}

/* -------------------------------------------------------------------------
   Line handling
   ---------------------------------------------------------------------- */

/**
 * RFC 5545 folds long lines by breaking them and prefixing the continuation
 * with a space or tab. Unfold before anything else or long summaries arrive
 * chopped in half.
 */
function unfold(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (/^[ \t]/.test(line) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Reverse the TEXT escaping: \n \, \; \\ */
function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseProp(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

/* -------------------------------------------------------------------------
   Dates
   ---------------------------------------------------------------------- */

interface ParsedDate {
  date: Date;
  allDay: boolean;
}

/**
 * Handles the three shapes that turn up in practice:
 *   VALUE=DATE:20260912                  -> all-day
 *   20260912T140000Z                     -> UTC
 *   TZID=America/New_York:20260912T140000 -> wall time
 *
 * A TZID time is read as local wall time rather than converted through a
 * timezone database. For a planner used in the timezone the calendar was
 * written in — the normal case for a school calendar — that is exactly right,
 * and it keeps this dependency-free.
 */
function parseDate(prop: Prop): ParsedDate | null {
  const v = prop.value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return {
      date: new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0),
      allDay: true,
    };
  }

  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!dt) return null;
  const [, y, m, d, hh, mm, ss, z] = dt;
  if (z) {
    return {
      date: new Date(
        Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)),
      ),
      allDay: false,
    };
  }
  return {
    date: new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    ),
    allDay: false,
  };
}

/* -------------------------------------------------------------------------
   Recurrence
   ---------------------------------------------------------------------- */

const DAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/**
 * Expands the slice of RRULE that school calendars actually use: DAILY,
 * WEEKLY (with BYDAY) and MONTHLY, bounded by COUNT or UNTIL. Anything more
 * exotic yields just the first occurrence rather than guessing.
 *
 * Capped by both a horizon and an instance count so a rule with no end can
 * never spin.
 */
function expandRecurrence(
  start: Date,
  rrule: string,
  horizonDays: number,
  maxInstances: number,
): Date[] {
  const parts: Record<string, string> = {};
  for (const chunk of rrule.split(";")) {
    const eq = chunk.indexOf("=");
    if (eq > 0) parts[chunk.slice(0, eq).toUpperCase()] = chunk.slice(eq + 1);
  }

  const freq = (parts.FREQ ?? "").toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(freq)) return [start];

  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);
  const count = parts.COUNT ? Number(parts.COUNT) : null;

  let until: Date | null = null;
  if (parts.UNTIL) {
    const parsed = parseDate({ name: "UNTIL", params: {}, value: parts.UNTIL });
    until = parsed?.date ?? null;
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + horizonDays);
  const limit = until && until < horizon ? until : horizon;

  const byDay = (parts.BYDAY ?? "")
    .split(",")
    .map((d) => DAY_INDEX[d.trim().slice(-2).toUpperCase()])
    .filter((n) => n !== undefined);

  const out: Date[] = [];
  const cursor = new Date(start);
  let guard = 0;

  while (out.length < maxInstances && guard < 2000) {
    guard += 1;
    if (cursor > limit) break;

    if (freq === "WEEKLY" && byDay.length > 0) {
      // Emit each requested weekday inside the current week.
      const weekStart = new Date(cursor);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      for (const dow of byDay) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + dow);
        d.setHours(
          start.getHours(),
          start.getMinutes(),
          start.getSeconds(),
          0,
        );
        if (d >= start && d <= limit && out.length < maxInstances) out.push(d);
      }
      cursor.setDate(cursor.getDate() + 7 * interval);
      continue;
    }

    out.push(new Date(cursor));
    if (count && out.length >= count) break;

    if (freq === "DAILY") cursor.setDate(cursor.getDate() + interval);
    else if (freq === "WEEKLY") cursor.setDate(cursor.getDate() + 7 * interval);
    else cursor.setMonth(cursor.getMonth() + interval);
  }

  const trimmed = count ? out.slice(0, count) : out;
  return trimmed.length > 0 ? trimmed : [start];
}

/* -------------------------------------------------------------------------
   ICS
   ---------------------------------------------------------------------- */

export interface ParseOptions {
  /** Expand RRULEs instead of keeping only the first occurrence. */
  includeRepeating: boolean;
  /** How far ahead recurring events are generated. */
  horizonDays?: number;
}

export function looksLikeIcs(text: string): boolean {
  return /BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(text);
}

export function parseIcs(
  raw: string,
  { includeRepeating, horizonDays = 120 }: ParseOptions,
): CalEvent[] {
  const lines = unfold(raw);
  const events: CalEvent[] = [];

  let current: Record<string, Prop> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^BEGIN:VEVENT$/i.test(trimmed)) {
      current = {};
      continue;
    }
    if (/^END:VEVENT$/i.test(trimmed)) {
      if (current) events.push(...buildEvents(current, includeRepeating, horizonDays));
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = parseProp(line);
    if (prop) current[prop.name] = prop;
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function buildEvents(
  props: Record<string, Prop>,
  includeRepeating: boolean,
  horizonDays: number,
): CalEvent[] {
  const summary = props.SUMMARY ? unescapeText(props.SUMMARY.value) : "";
  if (!summary) return [];

  const dtstart = props.DTSTART ? parseDate(props.DTSTART) : null;
  if (!dtstart) return [];

  const dtend = props.DTEND ? parseDate(props.DTEND) : null;
  const allDay =
    dtstart.allDay || props.DTSTART?.params.VALUE?.toUpperCase() === "DATE";

  const base = {
    summary,
    description: props.DESCRIPTION ? unescapeText(props.DESCRIPTION.value) : "",
    location: props.LOCATION ? unescapeText(props.LOCATION.value) : "",
    end: dtend?.date ?? null,
    allDay,
  };

  const uid = props.UID?.value?.trim() || `${summary}-${dtstart.date.getTime()}`;
  const rrule = props.RRULE?.value;

  if (!rrule) {
    return [{ ...base, uid, start: dtstart.date, repeated: false }];
  }

  if (!includeRepeating) {
    // Keep the series' first occurrence so the event is not lost entirely.
    return [{ ...base, uid, start: dtstart.date, repeated: true }];
  }

  return expandRecurrence(dtstart.date, rrule, horizonDays, 60).map((d, i) => ({
    ...base,
    uid: `${uid}-${i}`,
    start: d,
    repeated: i > 0,
  }));
}

/* -------------------------------------------------------------------------
   Pasted text
   ---------------------------------------------------------------------- */

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/** "Sep 12", "September 12, 2026", "9/12", "9/12/2026", "2026-09-12" */
function findDate(line: string, fallbackYear: number): Date | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(line);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const named = new RegExp(
    `\\b(${MONTHS.join("|")})[a-z]*\\.?\\s+(\\d{1,2})(?:\\s*,?\\s*(\\d{4}))?`,
    "i",
  ).exec(line);
  if (named) {
    const month = MONTHS.indexOf(named[1].toLowerCase().slice(0, 3));
    const year = named[3] ? Number(named[3]) : fallbackYear;
    return new Date(year, month, Number(named[2]));
  }

  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(line);
  if (numeric) {
    let year = numeric[3] ? Number(numeric[3]) : fallbackYear;
    if (year < 100) year += 2000;
    return new Date(year, Number(numeric[1]) - 1, Number(numeric[2]));
  }

  return null;
}

/** Strip the matched date and common connectors out of the title. */
function cleanTitle(line: string): string {
  return line
    .replace(/(\d{4})-(\d{2})-(\d{2})/g, "")
    .replace(
      new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\.?\\s+\\d{1,2}(\\s*,?\\s*\\d{4})?`, "gi"),
      "",
    )
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, "")
    .replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/gi, "")
    .replace(/\b(due|due date|assigned|all day)\b:?/gi, "")
    .replace(/^[\s\-–—•*,|]+|[\s\-–—•*,|]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Best-effort parse of text copied out of a calendar page. Each line that
 * contains something date-shaped becomes an event; everything else is skipped
 * rather than guessed at.
 */
export function parsePastedText(raw: string): CalEvent[] {
  const year = new Date().getFullYear();
  const events: CalEvent[] = [];

  for (const line of raw.split(/\n+/)) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;

    const date = findDate(trimmed, year);
    if (!date || Number.isNaN(date.getTime())) continue;

    const title = cleanTitle(trimmed);
    if (!title) continue;

    const time = /\b(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(trimmed);
    let allDay = true;
    if (time) {
      let hh = Number(time[1]);
      const mm = Number(time[2]);
      const mer = time[3]?.toLowerCase();
      if (mer === "pm" && hh < 12) hh += 12;
      if (mer === "am" && hh === 12) hh = 0;
      date.setHours(hh, mm, 0, 0);
      allDay = false;
    }

    events.push({
      uid: `${title}-${date.getTime()}`,
      summary: title,
      description: "",
      location: "",
      start: date,
      end: null,
      allDay,
      repeated: false,
    });
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Picks the right parser for whatever was pasted or dropped in. */
export function parseCalendar(raw: string, opts: ParseOptions): CalEvent[] {
  return looksLikeIcs(raw) ? parseIcs(raw, opts) : parsePastedText(raw);
}
