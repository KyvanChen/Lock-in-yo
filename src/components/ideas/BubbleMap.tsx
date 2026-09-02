// No "use client" directive: this is a leaf rendered only inside the Ideas
// page, which is already a client component. Marking it as its own client
// entry point makes Next treat these callback props as server-action
// candidates and warn that they aren't serializable.
import { useCallback, useEffect, useRef } from "react";
import { IDEA_COLORS, type Idea } from "@/lib/types";

interface Sim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Held still while dragged. */
  fixed: boolean;
  /** Phase offset so bubbles don't all breathe in unison. */
  phase: number;
}

/** Bubble radius grows with the text, within comfortable bounds. */
function radiusFor(text: string): number {
  return Math.max(38, Math.min(74, 32 + text.trim().length * 1.5));
}

export interface BubbleMapHandle {
  /** Viewport-centre coordinates, for placing a new root bubble. */
  centre: () => { x: number; y: number };
}

export function BubbleMap({
  ideas,
  selectedId,
  onSelect,
  onMove,
  onCanvasAdd,
}: {
  ideas: Idea[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Fired on drag end, so positions persist without spamming sync. */
  onMove: (id: string, x: number, y: number) => void;
  onCanvasAdd: (x: number, y: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const edgeEls = useRef(new Map<string, SVGLineElement>());
  const sim = useRef(new Map<string, Sim>());
  const size = useRef({ w: 800, h: 600 });
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /* --- One tick of the force simulation ---------------------------------
     Split out from the animation loop so a freshly loaded board can be run
     forward many steps at once, arriving already untangled instead of
     visibly sorting itself out over several seconds. */
  const stepPhysics = useCallback(
    (list: Idea[], t: number, idle: boolean) => {
      const nodes = [...sim.current.values()];
      const { w, h } = size.current;
      // A hidden container reports zero size. Stepping anyway would clamp
      // every bubble into the top-left corner and destroy the layout.
      if (w < 50 || h < 50) return;

      for (let a = 0; a < nodes.length; a++) {
        const A = nodes[a];
        if (A.fixed) continue;

        for (let b = 0; b < nodes.length; b++) {
          if (a === b) continue;
          const B = nodes[b];
          let dx = A.x - B.x;
          let dy = A.y - B.y;
          let dist = Math.hypot(dx, dy);
          if (dist < 0.01) {
            // Perfectly stacked bubbles have no direction to separate along.
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            dist = 1;
          }
          const min = A.r + B.r + 18;
          if (dist < min) {
            const push = ((min - dist) / dist) * 0.5;
            A.vx += dx * push;
            A.vy += dy * push;
          }
        }

        // Centring, weak enough that clusters keep their own shape.
        A.vx += (w / 2 - A.x) * 0.0016;
        A.vy += (h / 2 - A.y) * 0.0016;

        if (idle) {
          A.vx += Math.cos(t * 0.6 + A.phase) * 0.035;
          A.vy += Math.sin(t * 0.5 + A.phase) * 0.035;
        }
      }

      // Springs along each parent link.
      for (const idea of list) {
        if (!idea.parent_id) continue;
        const child = sim.current.get(idea.id);
        const parent = sim.current.get(idea.parent_id);
        if (!child || !parent) continue;
        const dx = parent.x - child.x;
        const dy = parent.y - child.y;
        const dist = Math.hypot(dx, dy) || 1;
        const rest = child.r + parent.r + 56;
        const force = (dist - rest) * 0.012;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (!child.fixed) {
          child.vx += fx;
          child.vy += fy;
        }
        if (!parent.fixed) {
          parent.vx -= fx * 0.45;
          parent.vy -= fy * 0.45;
        }
      }

      for (const N of nodes) {
        if (N.fixed) continue;
        N.vx *= 0.86;
        N.vy *= 0.86;
        // Clamp so a badly overlapped start can't fling bubbles off-screen.
        const speed = Math.hypot(N.vx, N.vy);
        if (speed > 14) {
          N.vx = (N.vx / speed) * 14;
          N.vy = (N.vy / speed) * 14;
        }
        N.x += N.vx;
        N.y += N.vy;
        N.x = Math.max(N.r + 4, Math.min(w - N.r - 4, N.x));
        N.y = Math.max(N.r + 4, Math.min(h - N.r - 4, N.y));
      }
    },
    [],
  );

  /** Write current simulation positions to the DOM. */
  const paint = useCallback((list: Idea[]) => {
    for (const [id, N] of sim.current) {
      const el = nodeEls.current.get(id);
      if (el) {
        el.style.transform = `translate3d(${N.x - N.r}px, ${N.y - N.r}px, 0)`;
        el.style.width = `${N.r * 2}px`;
        el.style.height = `${N.r * 2}px`;
      }
    }
    for (const idea of list) {
      if (!idea.parent_id) continue;
      const line = edgeEls.current.get(idea.id);
      const c = sim.current.get(idea.id);
      const p = sim.current.get(idea.parent_id);
      if (line && c && p) {
        line.setAttribute("x1", String(p.x));
        line.setAttribute("y1", String(p.y));
        line.setAttribute("x2", String(c.x));
        line.setAttribute("y2", String(c.y));
      }
    }
  }, []);

  /* --- Keep the simulation in step with the idea list -------------------
     Bubbles without a saved position get a radial tree layout rather than
     being dropped in a pile for the physics to untangle. Damping means a
     force simulation settles long before it separates a stack, so the
     opening frame has to be laid out deliberately; the springs then only
     have to keep it lively. */
  useEffect(() => {
    // Read the box here: this effect runs before the ResizeObserver below on
    // the very first pass, and a wrong canvas size lays the tree out offscreen.
    if (wrap.current) {
      size.current = {
        w: wrap.current.clientWidth || size.current.w,
        h: wrap.current.clientHeight || size.current.h,
      };
    }

    const live = new Set(ideas.map((i) => i.id));
    for (const id of [...sim.current.keys()]) {
      if (!live.has(id)) sim.current.delete(id);
    }

    const fresh = new Set<string>();
    for (const idea of ideas) {
      const existing = sim.current.get(idea.id);
      if (existing) {
        existing.r = radiusFor(idea.text);
        continue;
      }
      if (!idea.x && !idea.y) fresh.add(idea.id);
      sim.current.set(idea.id, {
        x: idea.x || size.current.w / 2,
        y: idea.y || size.current.h / 2,
        vx: 0,
        vy: 0,
        r: radiusFor(idea.text),
        fixed: false,
        phase: Math.random() * Math.PI * 2,
      });
    }

    if (fresh.size === 0) return;

    const { w, h } = size.current;
    const byParent = new Map<string | null, Idea[]>();
    for (const i of ideas) {
      byParent.set(i.parent_id, [...(byParent.get(i.parent_id) ?? []), i]);
    }

    const place = (idea: Idea, angle: number, spread: number) => {
      const self = sim.current.get(idea.id);
      if (!self) return;
      const kids = byParent.get(idea.id) ?? [];
      kids.forEach((kid, i) => {
        const kidNode = sim.current.get(kid.id);
        if (!kidNode) return;
        // Fan the children out around the direction this branch is heading.
        const offset =
          kids.length === 1 ? 0 : (i / (kids.length - 1) - 0.5) * spread;
        const a = angle + offset;
        if (fresh.has(kid.id)) {
          const dist = self.r + kidNode.r + 70;
          kidNode.x = self.x + Math.cos(a) * dist;
          kidNode.y = self.y + Math.sin(a) * dist;
        }
        place(kid, a, spread * 0.65);
      });
    };

    const roots = byParent.get(null) ?? [];
    roots.forEach((root, i) => {
      const node = sim.current.get(root.id);
      if (!node) return;
      const a =
        roots.length === 1 ? -Math.PI / 2 : (i / roots.length) * Math.PI * 2;
      if (fresh.has(root.id)) {
        const rad = roots.length === 1 ? 0 : Math.min(w, h) * 0.24;
        node.x = w / 2 + Math.cos(a) * rad;
        node.y = h / 2 + Math.sin(a) * rad;
      }
      place(root, a, Math.PI * 1.5);
    });

    // A short relaxation pass clears any residual overlap the fan left behind.
    if (fresh.size > 1) {
      for (let i = 0; i < 40; i++) stepPhysics(ideas, 0, false);
    }

    // Paint immediately rather than waiting for the first animation frame.
    // requestAnimationFrame doesn't fire while the page is hidden, so without
    // this the board would sit stacked in the corner until it became visible.
    paint(ideas);
    // No setState needed: `ideas` is a prop, so the bubbles have already been
    // rendered by the time this runs.
  }, [ideas, stepPhysics, paint]);

  /* --- Track the canvas size ------------------------------------------- */
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // Keep the last real measurement when the element reports zero, which
    // happens whenever it's hidden — a background tab, or a collapsed pane.
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) size.current = { w, h };
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  /* --- The physics loop -------------------------------------------------
     Repulsion keeps bubbles apart, springs hold branches near their parent,
     and a weak pull toward centre stops the map drifting off screen. Positions
     are written straight to the DOM rather than through React, so a busy board
     still animates at full rate. */
  useEffect(() => {
    let raf = 0;
    let t = 0;

    const step = () => {
      t += 0.016;
      stepPhysics(ideas, t, !reduced);
      paint(ideas);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [ideas, reduced, stepPhysics, paint]);

  /* --- Dragging --------------------------------------------------------- */
  const onPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      const node = sim.current.get(id);
      const box = wrap.current?.getBoundingClientRect();
      if (!node || !box) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      node.fixed = true;
      node.vx = 0;
      node.vy = 0;
      drag.current = {
        id,
        dx: node.x - (e.clientX - box.left),
        dy: node.y - (e.clientY - box.top),
      };
      onSelect(id);
    },
    [onSelect],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const box = wrap.current?.getBoundingClientRect();
    if (!d || !box) return;
    const node = sim.current.get(d.id);
    if (!node) return;
    node.x = e.clientX - box.left + d.dx;
    node.y = e.clientY - box.top + d.dy;
  }, []);

  const endDrag = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    const node = sim.current.get(d.id);
    if (node) {
      node.fixed = false;
      onMove(d.id, Math.round(node.x), Math.round(node.y));
    }
    drag.current = null;
  }, [onMove]);

  return (
    <div
      ref={wrap}
      className="relative w-full touch-none overflow-hidden rounded-card"
      style={{
        height: "min(70vh, 620px)",
        background: "var(--grouped-secondary)",
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget && e.target !== svg.current) return;
        const box = wrap.current?.getBoundingClientRect();
        if (box) onCanvasAdd(e.clientX - box.left, e.clientY - box.top);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === svg.current) {
          onSelect(null);
        }
      }}
    >
      <svg ref={svg} className="absolute inset-0 h-full w-full">
        {ideas
          .filter((i) => i.parent_id)
          .map((i) => (
            <line
              key={i.id}
              ref={(el) => {
                if (el) edgeEls.current.set(i.id, el);
                else edgeEls.current.delete(i.id);
              }}
              stroke={IDEA_COLORS[i.color % IDEA_COLORS.length]}
              strokeWidth={2}
              strokeOpacity={0.35}
              strokeLinecap="round"
            />
          ))}
      </svg>

      {ideas.map((idea) => {
        const color = IDEA_COLORS[idea.color % IDEA_COLORS.length];
        const active = idea.id === selectedId;
        return (
          <div
            key={idea.id}
            ref={(el) => {
              if (el) nodeEls.current.set(idea.id, el);
              else nodeEls.current.delete(idea.id);
            }}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={idea.text || "Untitled idea"}
            onPointerDown={(e) => onPointerDown(e, idea.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(idea.id);
              }
            }}
            className="absolute left-0 top-0 flex cursor-grab select-none items-center justify-center rounded-full p-3 text-center active:cursor-grabbing"
            style={{
              background: `color-mix(in srgb, ${color} ${active ? 30 : 18}%, transparent)`,
              boxShadow: active
                ? `0 0 0 2.5px ${color}, 0 8px 24px rgba(0,0,0,0.18)`
                : `inset 0 0 0 1.5px color-mix(in srgb, ${color} 45%, transparent)`,
              transition: "background 0.2s, box-shadow 0.2s",
              willChange: "transform",
            }}
          >
            <span
              className="pointer-events-none line-clamp-4 text-footnote font-medium leading-tight"
              style={{ color: active ? color : "var(--label)" }}
            >
              {idea.text || "…"}
            </span>
          </div>
        );
      })}

      {ideas.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-title3 font-semibold">Nothing on the board</p>
          <p className="max-w-[32ch] text-subheadline text-label-secondary">
            Double-tap anywhere to drop your first bubble, then branch off it.
          </p>
        </div>
      )}
    </div>
  );
}
