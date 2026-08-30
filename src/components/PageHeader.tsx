"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

/**
 * The large title reads as the page's heading while you are at the top, then
 * hands off to a compact translucent bar once it scrolls away, so you never
 * lose track of where you are. The bar holds its 52px whether or not it is
 * visible, which doubles as the page's top margin and keeps the layout from
 * jumping at the handoff.
 *
 * HIG > Layout: keep primary elements toward the top so people don't lose
 * track of them. HIG > Materials: the bar separates the chrome layer from the
 * content scrolling beneath it.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        className={cx(
          "sticky top-0 z-30 -mx-4 px-4 transition-[opacity,border-color] duration-200",
          collapsed ? "material border-b opacity-100" : "opacity-0",
        )}
        style={{ borderColor: collapsed ? "var(--separator)" : "transparent" }}
        aria-hidden={!collapsed}
      >
        <div className="flex h-[52px] items-center justify-between gap-3">
          <span className="truncate text-headline font-semibold">{title}</span>
          {action}
        </div>
      </div>

      <header className="mb-5 flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="text-large-title font-bold tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-subheadline text-label-secondary">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </header>

      {/* Watched edge: once this passes under the top, the bar takes over. */}
      <div ref={sentinel} className="pointer-events-none -mt-5 h-px" />
    </>
  );
}
