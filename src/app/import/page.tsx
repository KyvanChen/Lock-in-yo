"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { parseCalendar, looksLikeIcs } from "@/lib/ics";
import { buildDrafts, dueTimestamp, type ImportDraft } from "@/lib/importing";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/types";
import { formatDue } from "@/lib/date";
import {
  Button,
  EmptyState,
  Field,
  ListGroup,
  cx,
  inputClass,
  inputStyle,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { CheckIcon } from "@/components/icons";

export default function ImportPage() {
  const { tasks, addTask } = useData();
  const [raw, setRaw] = useState("");
  const [includeRepeating, setIncludeRepeating] = useState(false);
  const [drafts, setDrafts] = useState<ImportDraft[] | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const parse = (text: string, repeating = includeRepeating) => {
    setError(null);
    setImported(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setDrafts(null);
      return;
    }
    try {
      const events = parseCalendar(trimmed, {
        includeRepeating: repeating,
        horizonDays: 120,
      });
      if (events.length === 0) {
        setDrafts([]);
        setError(
          looksLikeIcs(trimmed)
            ? "That looks like a calendar file, but no events had both a title and a date."
            : "Couldn't find any dates in that text. Try exporting a .ics file instead — it's far more reliable.",
        );
        return;
      }
      setDrafts(buildDrafts(events, tasks));
    } catch {
      setDrafts([]);
      setError("Couldn't read that. If you have a .ics file, use Choose file.");
    }
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    parse(text);
  };

  const update = (uid: string, patch: Partial<ImportDraft>) =>
    setDrafts((prev) =>
      prev ? prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d)) : prev,
    );

  const selected = useMemo(
    () => (drafts ?? []).filter((d) => d.include),
    [drafts],
  );

  const runImport = () => {
    for (const d of selected) {
      addTask({
        title: d.title,
        category: d.category,
        course: d.course.trim(),
        due_at: dueTimestamp(d),
      });
    }
    setImported(selected.length);
    setDrafts(null);
    setRaw("");
  };

  const setAll = (include: boolean) =>
    setDrafts((prev) => (prev ? prev.map((d) => ({ ...d, include })) : prev));

  const duplicateCount = (drafts ?? []).filter((d) => d.duplicate).length;

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-24 md:pb-10">
      <PageHeader
        title="Import"
        subtitle="Bring your Schoology or Google Calendar in and turn it into tasks."
      />

      {imported !== null ? (
        <EmptyState
          icon={<CheckIcon />}
          title={`Added ${imported} ${imported === 1 ? "task" : "tasks"}`}
          message="They're in your planner now, and anything with a due date shows up on the Week view."
          action={
            <div className="flex gap-2">
              <Link href="/">
                <Button variant="filled">Open planner</Button>
              </Link>
              <Link href="/calendar">
                <Button>Open calendar</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <ListGroup header="Where to get the file" className="mb-5">
            <div className="space-y-3 px-4 py-3.5 text-footnote text-label-secondary">
              <p>
                <strong className="text-label">Google Calendar</strong> — on a
                computer, Settings (gear) → Settings → Import &amp; export →
                Export. That downloads a .zip; unzip it and pick the .ics inside.
              </p>
              <p>
                <strong className="text-label">Schoology</strong> — Calendar →
                the iCal / RSS icon → copy the feed link, open it in a new tab,
                then select everything on that page and paste it below.
              </p>
              <p>
                Or just copy a list of assignments off any page and paste it —
                every line with a date in it becomes a task.
              </p>
            </div>
          </ListGroup>

          <Field label="Paste your calendar">
            <textarea
              rows={7}
              className={cx(inputClass, "resize-y font-mono text-footnote")}
              style={inputStyle}
              value={raw}
              placeholder={"BEGIN:VCALENDAR\n…\n\nor\n\nSep 12 — Bio lab writeup\nSep 15 — Calc problem set 7"}
              onChange={(e) => {
                setRaw(e.target.value);
                parse(e.target.value);
              }}
            />
          </Field>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => fileInput.current?.click()}>
              Choose .ics file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".ics,text/calendar,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <label className="flex min-h-[44px] items-center gap-2 text-footnote text-label-secondary">
              <input
                type="checkbox"
                checked={includeRepeating}
                className="h-[18px] w-[18px] accent-[var(--blue)]"
                onChange={(e) => {
                  setIncludeRepeating(e.target.checked);
                  parse(raw, e.target.checked);
                }}
              />
              Include repeating events
            </label>
            {raw && (
              <Button
                variant="plain"
                onClick={() => {
                  setRaw("");
                  setDrafts(null);
                  setError(null);
                }}
              >
                Clear
              </Button>
            )}
          </div>

          <p className="mt-2 text-caption text-label-tertiary">
            Repeating events are usually class periods rather than work, so
            they&rsquo;re left out unless you ask for them.
          </p>

          {error && (
            <p
              role="status"
              className="mt-4 rounded-control p-3 text-footnote"
              style={{
                background: "color-mix(in srgb, var(--orange) 12%, transparent)",
                color: "var(--orange)",
              }}
            >
              {error}
            </p>
          )}

          {drafts && drafts.length > 0 && (
            <section className="mt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-title3 font-bold">
                  Found {drafts.length}{" "}
                  {drafts.length === 1 ? "event" : "events"}
                </h2>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setAll(true)}>
                    Select all
                  </Button>
                  <Button size="sm" onClick={() => setAll(false)}>
                    None
                  </Button>
                </div>
              </div>

              {duplicateCount > 0 && (
                <p className="mb-3 text-footnote text-label-secondary">
                  {duplicateCount} already{" "}
                  {duplicateCount === 1 ? "exists" : "exist"} in your planner, so{" "}
                  {duplicateCount === 1 ? "it's" : "they're"} unticked. Re-import
                  a feed any time — nothing gets doubled up.
                </p>
              )}

              <div className="space-y-2">
                {drafts.map((d) => (
                  <DraftRow key={d.uid} draft={d} onChange={update} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {drafts && drafts.length > 0 && selected.length > 0 && (
        /* Sticky so the action stays reachable however long the list runs. */
        <div className="safe-bottom material sticky bottom-0 z-20 -mx-4 mt-4 border-t px-4 py-3"
          style={{ borderColor: "var(--separator)" }}
        >
          <Button variant="filled" block size="lg" onClick={runImport}>
            Add {selected.length} {selected.length === 1 ? "task" : "tasks"}
          </Button>
        </div>
      )}
    </div>
  );
}

function DraftRow({
  draft,
  onChange,
}: {
  draft: ImportDraft;
  onChange: (uid: string, patch: Partial<ImportDraft>) => void;
}) {
  const meta = CATEGORY_META[draft.category];

  return (
    <div
      className="rounded-card p-3"
      style={{
        background: "var(--grouped-secondary)",
        opacity: draft.include ? 1 : 0.55,
      }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onChange(draft.uid, { include: !draft.include })}
          role="checkbox"
          aria-checked={draft.include}
          aria-label={`Import ${draft.title}`}
          className="mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[7px] border-[1.75px] text-[13px] text-white transition"
          style={{
            borderColor: draft.include ? "transparent" : "var(--label-tertiary)",
            background: draft.include ? "var(--blue)" : "transparent",
          }}
        >
          {draft.include && <CheckIcon />}
        </button>

        <div className="min-w-0 flex-1">
          <input
            value={draft.title}
            aria-label="Task title"
            onChange={(e) => onChange(draft.uid, { title: e.target.value })}
            className="w-full bg-transparent text-body outline-none focus:underline"
          />
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-footnote text-label-secondary">
            <span>{formatDue(dueTimestamp(draft))}</span>
            {draft.repeated && (
              <span className="text-label-tertiary">repeats</span>
            )}
            {draft.duplicate && (
              <span style={{ color: "var(--orange)" }}>already added</span>
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <select
              value={draft.category}
              aria-label="Type"
              onChange={(e) =>
                onChange(draft.uid, { category: e.target.value as Category })
              }
              className="min-h-[36px] rounded-[8px] px-2 text-footnote font-medium outline-none"
              style={{
                background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                color: meta.color,
                border: `1px solid ${meta.color}`,
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              value={draft.course}
              aria-label="Class or project"
              placeholder="Class"
              onChange={(e) => onChange(draft.uid, { course: e.target.value })}
              className="min-h-[36px] min-w-0 flex-1 rounded-[8px] px-2.5 text-footnote outline-none"
              style={{
                background: "var(--fill-quaternary)",
                color: "var(--label)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
