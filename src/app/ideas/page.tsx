"use client";

import { useMemo, useRef, useState } from "react";
import { useData } from "@/lib/store";
import { IDEA_COLORS, type Idea } from "@/lib/types";
import { BubbleMap } from "@/components/ideas/BubbleMap";
import { PageHeader } from "@/components/PageHeader";
import { Button, cx, inputClass, inputStyle } from "@/components/ui";
import { PlusIcon, TrashIcon } from "@/components/icons";

const SEEDS = [
  "Something I could build",
  "Science fair idea",
  "College essay angle",
  "App I wish existed",
  "Club or project to start",
];

export default function IdeasPage() {
  const { ideas, addIdea, updateIdea, deleteIdea, addTask } = useData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<string | null>(null);
  const textRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => ideas.find((i) => i.id === selectedId) ?? null,
    [ideas, selectedId],
  );

  /** Walks up to the root so a branch can inherit its theme as the class. */
  const rootOf = (idea: Idea): Idea => {
    let cur = idea;
    const guard = new Set<string>();
    while (cur.parent_id && !guard.has(cur.id)) {
      guard.add(cur.id);
      const parent = ideas.find((i) => i.id === cur.parent_id);
      if (!parent) break;
      cur = parent;
    }
    return cur;
  };

  const addRoot = (x: number, y: number, text = "") => {
    const idea = addIdea({
      text,
      parent_id: null,
      color: ideas.length % IDEA_COLORS.length,
      x,
      y,
    });
    setSelectedId(idea.id);
    setPromoted(null);
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const branch = () => {
    if (!selected) return;
    const idea = addIdea({
      text: "",
      parent_id: selected.id,
      // Children shift one step along the palette, so a branch reads as
      // related to its parent without being identical.
      color: (selected.color + 1) % IDEA_COLORS.length,
      x: selected.x,
      y: selected.y,
    });
    setSelectedId(idea.id);
    setPromoted(null);
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const promote = () => {
    if (!selected || !selected.text.trim()) return;
    const root = rootOf(selected);
    addTask({
      title: selected.text.trim(),
      category: "project",
      course: root.id === selected.id ? "" : root.text.trim(),
      notes: "From the brainstorm board.",
    });
    setPromoted(selected.id);
  };

  const remove = () => {
    if (!selected) return;
    deleteIdea(selected.id);
    setSelectedId(null);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 md:pb-10">
      <PageHeader
        title="Ideas"
        subtitle="Get it out of your head first. Tidy it up after."
        action={
          <Button
            size="sm"
            className="shrink-0"
            variant="filled"
            onClick={() => addRoot(120 + Math.random() * 160, 100 + Math.random() * 120)}
          >
            <PlusIcon className="text-[16px]" />
            Bubble
          </Button>
        }
      />

      <BubbleMap
        ideas={ideas}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setPromoted(null);
        }}
        onMove={(id, x, y) => updateIdea(id, { x, y })}
        onCanvasAdd={(x, y) => addRoot(x, y)}
      />

      {selected ? (
        <section
          className="mt-3 rounded-card p-3"
          style={{ background: "var(--grouped-secondary)" }}
        >
          <input
            ref={textRef}
            value={selected.text}
            placeholder="What's the idea?"
            aria-label="Idea text"
            className={inputClass}
            style={inputStyle}
            onChange={(e) => updateIdea(selected.id, { text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                branch();
              }
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="filled"
              tint={IDEA_COLORS[selected.color % IDEA_COLORS.length]}
              onClick={branch}
            >
              <PlusIcon className="text-[15px]" />
              Branch off
            </Button>

            <Button
              size="sm"
              onClick={promote}
              disabled={!selected.text.trim() || promoted === selected.id}
              tint="var(--green)"
            >
              {promoted === selected.id ? "Added to planner" : "Make it a project"}
            </Button>

            <div
              className="flex items-center gap-1.5 rounded-full p-1"
              style={{ background: "var(--fill-quaternary)" }}
              role="radiogroup"
              aria-label="Bubble colour"
            >
              {IDEA_COLORS.map((c, i) => (
                <button
                  key={c}
                  role="radio"
                  aria-checked={selected.color === i}
                  aria-label={`Colour ${i + 1}`}
                  onClick={() => updateIdea(selected.id, { color: i })}
                  className={cx(
                    "h-6 w-6 rounded-full transition",
                    selected.color === i && "scale-110",
                  )}
                  style={{
                    background: c,
                    boxShadow:
                      selected.color === i
                        ? "0 0 0 2px var(--grouped-secondary), 0 0 0 3.5px currentColor"
                        : undefined,
                    color: c,
                  }}
                />
              ))}
            </div>

            <Button
              size="sm"
              variant="tinted"
              tint="var(--red)"
              onClick={remove}
              aria-label="Delete bubble and its branches"
              className="ml-auto"
            >
              <TrashIcon className="text-[16px]" />
            </Button>
          </div>

          <p className="mt-2 text-caption text-label-tertiary">
            Enter branches off this bubble. Drag bubbles to rearrange, or
            double-tap empty space for a new one. Deleting takes its branches
            with it.
          </p>
        </section>
      ) : (
        <section className="mt-3">
          <p className="mb-2 px-1 text-footnote text-label-secondary">
            {ideas.length === 0
              ? "Start from a prompt, or double-tap the board."
              : "Tap a bubble to edit it, or start a new thread:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {SEEDS.map((s) => (
              <button
                key={s}
                onClick={() =>
                  addRoot(
                    140 + Math.random() * 200,
                    110 + Math.random() * 140,
                    s,
                  )
                }
                className="press rounded-full px-3.5 py-2 text-footnote font-medium transition active:scale-[0.97]"
                style={{ background: "var(--fill-quaternary)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
