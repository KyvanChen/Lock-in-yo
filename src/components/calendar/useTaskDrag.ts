// No "use client" directive: this hook is only ever called from the calendar
// page, which is already a client component. Marking it as its own client
// entry makes Next read these callbacks as server-action candidates.
import { useCallback, useRef, useState } from "react";

export interface DragGhost {
  x: number;
  y: number;
  title: string;
  color: string;
}

/**
 * Pointer-based dragging of task chips onto day cells.
 *
 * Deliberately not HTML5 drag-and-drop: that API does nothing on touch, and
 * dropping homework onto a day is exactly the sort of thing you do on a phone.
 * Pointer events cover mouse, touch and pen with one path.
 *
 * A drag only begins after the pointer travels a few pixels, so a plain tap
 * still opens the task rather than being swallowed as a zero-distance drag.
 */
export function useTaskDrag({
  onDrop,
  onTap,
}: {
  onDrop: (taskId: string, dayKey: string) => void;
  onTap: (taskId: string) => void;
}) {
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const pending = useRef<{
    id: string;
    x: number;
    y: number;
    title: string;
    color: string;
  } | null>(null);
  const dragging = useRef(false);
  // Mirrors hoverKey: the pointerup handler closes over a stale state value.
  const hoverRef = useRef<string | null>(null);
  const rects = useRef<{ key: string; rect: DOMRect }[]>([]);

  /** Measure the day cells once per drag rather than on every move. */
  const snapshot = useCallback(() => {
    rects.current = [...document.querySelectorAll<HTMLElement>("[data-day]")].map(
      (el) => ({ key: el.dataset.day as string, rect: el.getBoundingClientRect() }),
    );
  }, []);

  const reset = useCallback(() => {
    pending.current = null;
    dragging.current = false;
    hoverRef.current = null;
    setGhost(null);
    setHoverKey(null);
  }, []);

  const bind = useCallback(
    (task: { id: string; title: string }, color: string) => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        pending.current = {
          id: task.id,
          x: e.clientX,
          y: e.clientY,
          title: task.title,
          color,
        };
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },

      onPointerMove: (e: React.PointerEvent) => {
        const p = pending.current;
        if (!p) return;
        if (!dragging.current) {
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
          dragging.current = true;
          snapshot();
        }
        setGhost({ x: e.clientX, y: e.clientY, title: p.title, color: p.color });
        const hit = rects.current.find(
          ({ rect }) =>
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom,
        );
        hoverRef.current = hit?.key ?? null;
        setHoverKey(hoverRef.current);
      },

      onPointerUp: () => {
        const p = pending.current;
        const wasDragging = dragging.current;
        const target = hoverRef.current;
        reset();
        if (!p) return;
        if (wasDragging) {
          if (target) onDrop(p.id, target);
        } else {
          onTap(p.id);
        }
      },

      onPointerCancel: reset,
    }),
    [onDrop, onTap, reset, snapshot],
  );

  return { bind, ghost, hoverKey, dragging: ghost !== null };
}
