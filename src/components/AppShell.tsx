"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store";
import { useTimer } from "@/lib/timer";
import { formatClock } from "@/lib/date";
import { cx } from "./ui";
import {
  BoardIcon,
  CalendarIcon,
  ChartIcon,
  PersonIcon,
  TimerIcon,
} from "./icons";

const TABS = [
  { href: "/", label: "Planner", Icon: CalendarIcon },
  { href: "/calendar", label: "Calendar", Icon: BoardIcon },
  { href: "/lockin", label: "Lock In", Icon: TimerIcon },
  { href: "/stats", label: "Stats", Icon: ChartIcon },
  { href: "/account", label: "Account", Icon: PersonIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready } = useData();
  const { locked, running, phase, remaining, elapsed, countUp } = useTimer();

  // The lock-in screen takes over the window: no nav, nothing to click away to.
  if (locked) return <>{children}</>;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const clock = formatClock(countUp ? elapsed : remaining);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Sidebar — the desktop convention for primary navigation. */}
      <nav
        aria-label="Sections"
        className="material sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-1 border-r p-3 md:flex"
        style={{ borderColor: "var(--separator)" }}
      >
        <div className="px-3 pb-4 pt-3">
          <p className="text-title2 font-bold tracking-[-0.02em]">Lock In</p>
          <p className="text-footnote text-label-secondary">
            Plan it, then do it.
          </p>
        </div>

        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "press flex min-h-[44px] items-center gap-3 rounded-control px-3 text-callout transition",
                active ? "font-semibold" : "font-medium text-label-secondary",
              )}
              style={
                active
                  ? {
                      background: "color-mix(in srgb, var(--blue) 14%, transparent)",
                      color: "var(--blue)",
                    }
                  : undefined
              }
            >
              <Icon className="text-[20px]" />
              {label}
              {href === "/lockin" && running && (
                <span className="tnum ml-auto text-footnote font-semibold text-blue">
                  {clock}
                </span>
              )}
            </Link>
          );
        })}

        <div className="mt-auto px-3 pb-2">
          <p className="text-caption text-label-tertiary">
            {phase === "focus" ? "Focus" : "Break"} ·{" "}
            {running ? "running" : "paused"}
          </p>
        </div>
      </nav>

      <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0">
        {ready ? children : <BootSkeleton />}
      </main>

      {/* Bottom tab bar — the mobile convention. */}
      <nav
        aria-label="Sections"
        className="material safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t md:hidden"
        style={{ borderColor: "var(--separator)" }}
      >
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5"
              style={{ color: active ? "var(--blue)" : "var(--label-secondary)" }}
            >
              <Icon className="text-[22px]" />
              <span
                className={cx(
                  "text-caption2",
                  active ? "font-semibold" : "font-medium",
                )}
              >
                {label}
              </span>
              {href === "/lockin" && running && !active && (
                <span
                  className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full"
                  style={{ background: "var(--blue)" }}
                  aria-label="Timer running"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function BootSkeleton() {
  return (
    <div className="mx-auto max-w-[720px] space-y-3 p-4" aria-busy="true">
      <div
        className="h-9 w-40 rounded-control"
        style={{ background: "var(--fill-tertiary)" }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 rounded-card"
          style={{ background: "var(--fill-quaternary)" }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
