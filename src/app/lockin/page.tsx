"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/lib/store";
import { useTimer } from "@/lib/timer";
import { useAmbient } from "@/lib/ambient";
import { METHODS, METHOD_BY_ID, type MethodId } from "@/lib/methods";
import { NOISE_SCENES, VIDEO_SCENES } from "@/lib/scenes";
import { formatClock, formatDuration } from "@/lib/date";
import { FlightPanel } from "@/components/lockin/FlightPanel";
import {
  Button,
  Field,
  Sheet,
  cx,
  inputClass,
  inputStyle,
} from "@/components/ui";
import {
  CloseIcon,
  ExpandIcon,
  PauseIcon,
  PlayIcon,
  SkipIcon,
  StopIcon,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";

const RADIUS = 120;
const CIRC = 2 * Math.PI * RADIUS;

export default function LockInPage() {
  const { tasks, settings, setSettings, sessions } = useData();
  const timer = useTimer();
  const ambient = useAmbient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);

  const {
    phase,
    running,
    remaining,
    elapsed,
    progress,
    countUp,
    taskId,
    setTaskId,
    start,
    pause,
    reset,
    skip,
    setPhase,
    distractions,
    flight,
    arrived,
    locked,
    setLocked,
    round,
  } = timer;

  const method = METHOD_BY_ID[settings.method];
  const openTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const activeTask = openTasks.find((t) => t.id === taskId) ?? null;
  const scene = VIDEO_SCENES.find((s) => s.id === settings.scene) ?? null;

  const todayFocus = useMemo(() => {
    const today = new Date().toDateString();
    return sessions
      .filter(
        (s) =>
          s.kind === "focus" && new Date(s.started_at).toDateString() === today,
      )
      .reduce((sum, s) => sum + s.duration_sec, 0);
  }, [sessions]);

  /* --- Lock in: take over the screen ------------------------------------- */
  const enterLock = useCallback(async () => {
    setLocked(true);
    try {
      await shell.current?.requestFullscreen?.();
    } catch {
      // Fullscreen can be refused; the fixed overlay still covers the window.
    }
  }, [setLocked]);

  const exitLock = useCallback(async () => {
    setLocked(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, [setLocked]);

  // Leaving fullscreen by any route (Esc, the system UI) must also unlock.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setLocked(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [setLocked]);

  /* --- Keyboard: space toggles, R resets, S skips ------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (running) pause();
        else start();
      } else if (e.key.toLowerCase() === "r") {
        reset();
      } else if (e.key.toLowerCase() === "s") {
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, pause, start, reset, skip]);

  const clock = formatClock(countUp ? elapsed : remaining);
  const phaseName =
    phase === "focus" ? "Focus" : phase === "long" ? "Long break" : "Break";
  const accent =
    phase === "focus" ? (flight ? "var(--blue)" : method.color) : "var(--green)";

  const applyMethod = (id: MethodId) => {
    const m = METHOD_BY_ID[id];
    setSettings({
      method: id,
      focus_min: m.focus_min || settings.focus_min,
      short_break_min: m.short_break_min || settings.short_break_min,
      long_break_min: m.long_break_min || settings.long_break_min,
      rounds_before_long: m.rounds_before_long,
      // Flight mode needs a fixed-length block to fly.
      flight_mode: m.countUp ? false : settings.flight_mode,
    });
  };

  /* ---------------------------------------------------------------------- */
  const Dial = (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90">
        <circle
          cx="140"
          cy="140"
          r={RADIUS}
          fill="none"
          stroke="var(--fill-tertiary)"
          strokeWidth="10"
        />
        {!countUp && (
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke={accent}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.9s linear" }}
          />
        )}
        {countUp && running && (
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            fill="none"
            stroke={accent}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${CIRC * 0.12} ${CIRC}`}
            style={{
              transformOrigin: "140px 140px",
              animation: "spin 3.5s linear infinite",
            }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-footnote font-semibold uppercase tracking-[0.08em]"
          style={{ color: accent }}
        >
          {phaseName}
        </span>
        <span
          className="tnum font-rounded text-[clamp(3rem,14vw,4.5rem)] font-bold leading-none tracking-[-0.03em]"
          role="timer"
          aria-live="off"
        >
          {clock}
        </span>
        <span className="mt-1 max-w-[80%] truncate text-footnote text-label-secondary">
          {activeTask ? activeTask.title : countUp ? "Working" : `Round ${round + 1}`}
        </span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const Controls = (
    <div className="flex items-center justify-center gap-3">
      <Button
        size="lg"
        variant="filled"
        tint={accent}
        onClick={running ? pause : start}
        className="min-w-[148px]"
        aria-label={running ? "Pause" : "Start"}
      >
        {running ? <PauseIcon /> : <PlayIcon />}
        {running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
      </Button>
      <Button
        size="lg"
        onClick={reset}
        aria-label="Stop and reset this block"
        title="Reset (R)"
      >
        <StopIcon />
      </Button>
      <Button
        size="lg"
        onClick={skip}
        aria-label={countUp ? "Take a break now" : "Skip to next block"}
        title="Skip (S)"
      >
        <SkipIcon />
      </Button>
    </div>
  );

  /* --- Locked, full-screen view ------------------------------------------ */
  if (locked) {
    return (
      <div
        ref={shell}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        {scene && (
          <>
            <iframe
              title={scene.name}
              className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2"
              src={`https://www.youtube.com/embed/${scene.youtube}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&rel=0&modestbranding=1&playlist=${scene.youtube}`}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            {/* Dimming layer keeps the numerals legible over bright video.
                HIG > Liquid Glass: dim bright content behind glass. */}
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}

        <div className="relative flex flex-col items-center gap-8 px-6 text-center">
          <span
            className="text-footnote font-semibold uppercase tracking-[0.16em]"
            style={{ color: scene ? "rgba(255,255,255,0.75)" : accent }}
          >
            {phaseName}
          </span>
          <span
            className="tnum font-rounded text-[clamp(4.5rem,20vw,11rem)] font-bold leading-none tracking-[-0.04em]"
            style={{ color: scene ? "#fff" : "var(--label)" }}
            role="timer"
          >
            {clock}
          </span>
          {activeTask && (
            <span
              className="max-w-[24ch] text-title3"
              style={{ color: scene ? "rgba(255,255,255,0.85)" : "var(--label-secondary)" }}
            >
              {activeTask.title}
            </span>
          )}
          {flight && (
            <span
              className="text-callout"
              style={{ color: scene ? "rgba(255,255,255,0.7)" : "var(--label-secondary)" }}
            >
              {flight.from} → {arrived || !flight.blind ? flight.to : "???"} ·{" "}
              {Math.round((arrived ? 1 : progress) * 100)}%
            </span>
          )}

          <div className="mt-2 flex items-center gap-3">
            <Button
              size="lg"
              variant="filled"
              tint={accent}
              onClick={running ? pause : start}
            >
              {running ? <PauseIcon /> : <PlayIcon />}
              {running ? "Pause" : "Start"}
            </Button>
            <Button
              size="lg"
              onClick={exitLock}
              style={
                scene
                  ? { background: "rgba(255,255,255,0.16)", color: "#fff" }
                  : undefined
              }
            >
              <CloseIcon />
              Exit
            </Button>
          </div>

          {distractions > 0 && (
            <p
              className="text-footnote"
              style={{ color: scene ? "rgba(255,255,255,0.6)" : "var(--label-tertiary)" }}
            >
              You left this tab {distractions}{" "}
              {distractions === 1 ? "time" : "times"} this block.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* --- Normal view -------------------------------------------------------- */
  return (
    <div ref={shell} className="mx-auto max-w-[720px] px-4 pb-24 pt-6 md:pb-10 md:pt-10">
      <PageHeader
        title="Lock In"
        subtitle={`${method.name} · ${method.tagline}`}
        action={
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
        }
      />

      {/* Today's total, so the timer has a point beyond itself. */}
      <div
        className="mb-5 flex items-center justify-between rounded-card px-4 py-3"
        style={{ background: "var(--grouped-secondary)" }}
      >
        <div>
          <p className="text-caption uppercase tracking-[0.06em] text-label-tertiary">
            Focused today
          </p>
          <p className="tnum text-title3 font-bold">
            {formatDuration(todayFocus)}
            <span className="text-subheadline font-medium text-label-secondary">
              {" "}
              / {settings.daily_goal_min}m goal
            </span>
          </p>
        </div>
        <div
          className="h-2 w-[38%] overflow-hidden rounded-full"
          style={{ background: "var(--fill-tertiary)" }}
          role="progressbar"
          aria-valuenow={Math.min(
            100,
            Math.round((todayFocus / 60 / settings.daily_goal_min) * 100),
          )}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress toward today's focus goal"
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (todayFocus / 60 / settings.daily_goal_min) * 100)}%`,
              background: "var(--green)",
            }}
          />
        </div>
      </div>

      {Dial}

      <div className="mt-6 space-y-4">
        {Controls}

        <div className="flex justify-center">
          <Button size="sm" onClick={enterLock}>
            <ExpandIcon className="text-[16px]" />
            Lock in full screen
          </Button>
        </div>

        {distractions > 0 && phase === "focus" && (
          <p className="text-center text-footnote text-label-tertiary">
            You left this tab {distractions}{" "}
            {distractions === 1 ? "time" : "times"} this block.
          </p>
        )}
      </div>

      {/* Phase switch */}
      <div className="mt-6 flex gap-2">
        {(["focus", "short", "long"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            aria-pressed={phase === p}
            className={cx(
              "min-h-[40px] flex-1 rounded-control text-subheadline transition",
              phase === p ? "font-semibold" : "font-medium text-label-secondary",
            )}
            style={
              phase === p
                ? {
                    background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                    color: accent,
                  }
                : { background: "var(--fill-quaternary)" }
            }
          >
            {p === "focus" ? "Focus" : p === "short" ? "Break" : "Long break"}
          </button>
        ))}
      </div>

      {/* What are you working on */}
      <div className="mt-4">
        <Field label="Working on">
          <select
            className={inputClass}
            style={inputStyle}
            value={taskId ?? ""}
            onChange={(e) => setTaskId(e.target.value || null)}
          >
            <option value="">Nothing in particular</option>
            {openTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.course ? `${t.course} — ${t.title}` : t.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {flight && (
        <div className="mt-5">
          <FlightPanel
            route={flight}
            /* Once landed the block underneath is a break, whose progress has
               nothing to do with the flight — pin the aircraft at the gate. */
            progress={arrived ? 1 : progress}
            blind={flight.blind}
            arrived={arrived}
          />
        </div>
      )}

      {scene && (
        <section className="mt-5">
          <div
            className="overflow-hidden rounded-card"
            style={{ background: "#000" }}
          >
            <iframe
              title={scene.name}
              className="aspect-video w-full"
              src={`https://www.youtube.com/embed/${scene.youtube}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <p className="mt-1.5 px-1 text-caption text-label-tertiary">
            {scene.note} Starts muted — use the player controls to hear it.
            Stream by {scene.source}.
          </p>
        </section>
      )}

      {/* Methods */}
      <section className="mt-8">
        <h2 className="mb-1 text-title3 font-bold">Method</h2>
        <p className="mb-3 text-footnote text-label-secondary">
          The block length that works is the one you will actually start.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {METHODS.map((m) => {
            const active = settings.method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => applyMethod(m.id)}
                aria-pressed={active}
                className="press rounded-card p-3 text-left transition active:scale-[0.99]"
                style={{
                  background: active
                    ? `color-mix(in srgb, ${m.color} 12%, transparent)`
                    : "var(--grouped-secondary)",
                  boxShadow: active ? `inset 0 0 0 1.5px ${m.color}` : undefined,
                }}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-headline font-semibold"
                    style={{ color: active ? m.color : "var(--label)" }}
                  >
                    {m.name}
                  </span>
                  <span className="text-caption text-label-secondary">
                    {m.tagline}
                  </span>
                </span>
                <span className="mt-1 block text-footnote text-label-secondary">
                  {m.detail}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Flight mode */}
      <section className="mt-8">
        <h2 className="mb-1 text-title3 font-bold">Random flight</h2>
        <p className="mb-3 text-footnote text-label-secondary">
          Turn the block into a real route. You take off when the timer starts
          and land when it ends — stay in your seat and you find out where you
          went.
        </p>
        <div
          className="divide-y overflow-hidden rounded-card"
          style={{ background: "var(--grouped-secondary)" }}
        >
          <Toggle
            label="Fly the block"
            hint={
              method.countUp
                ? "Needs a fixed-length block. Pick any method other than Flowtime."
                : "Picks a real route sized to your focus length."
            }
            checked={settings.flight_mode}
            disabled={method.countUp}
            onChange={(v) => setSettings({ flight_mode: v })}
          />
          <Toggle
            label="Random route"
            hint="Hide the destination until you land."
            checked={settings.flight_blind}
            disabled={!settings.flight_mode || method.countUp}
            onChange={(v) => setSettings({ flight_blind: v })}
          />
        </div>
      </section>

      {/* Scenes */}
      <section className="mt-8">
        <h2 className="mb-1 text-title3 font-bold">Scene</h2>
        <p className="mb-3 text-footnote text-label-secondary">
          Something calm to rest your eyes on. Nothing here has a plot, which is
          the point.
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          <SceneCard
            active={settings.scene === null}
            title="No video"
            note="Just the timer."
            onClick={() => setSettings({ scene: null })}
          />
          {VIDEO_SCENES.map((s) => (
            <SceneCard
              key={s.id}
              active={settings.scene === s.id}
              title={s.name}
              note={`${s.note} — ${s.source}`}
              onClick={() =>
                setSettings({ scene: settings.scene === s.id ? null : s.id })
              }
            />
          ))}
        </div>

        <h3 className="mb-2 mt-5 text-headline font-semibold">Sound</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {NOISE_SCENES.map((n) => (
            <SceneCard
              key={n.id}
              active={ambient.playing === n.id}
              title={n.name}
              note={n.note}
              onClick={() => ambient.setNoise(n.id)}
            />
          ))}
        </div>
        {ambient.playing && (
          <label className="mt-3 flex items-center gap-3 px-1">
            <span className="text-footnote text-label-secondary">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ambient.volume}
              onChange={(e) => ambient.setVolume(Number(e.target.value))}
              className="flex-1 accent-[var(--blue)]"
              aria-label="Ambient sound volume"
            />
          </label>
        )}
      </section>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cx(
        "flex min-h-[56px] items-center justify-between gap-3 px-4 py-3",
        disabled && "opacity-50",
      )}
      style={{ borderColor: "var(--separator)" }}
    >
      <span className="min-w-0">
        <span className="block text-body">{label}</span>
        {hint && (
          <span className="block text-footnote text-label-secondary">{hint}</span>
        )}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
        style={{ background: checked ? "var(--green)" : "var(--fill)" }}
      >
        <span
          className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white transition-transform duration-200"
          style={{
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            transform: checked ? "translateX(22px)" : "translateX(2px)",
          }}
        />
      </button>
    </label>
  );
}

function SceneCard({
  active,
  title,
  note,
  onClick,
}: {
  active: boolean;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="press rounded-card p-3 text-left transition active:scale-[0.99]"
      style={{
        background: active
          ? "color-mix(in srgb, var(--blue) 12%, transparent)"
          : "var(--grouped-secondary)",
        boxShadow: active ? "inset 0 0 0 1.5px var(--blue)" : undefined,
      }}
    >
      <span
        className="block text-headline font-semibold"
        style={{ color: active ? "var(--blue)" : "var(--label)" }}
      >
        {title}
      </span>
      <span className="mt-0.5 block text-footnote text-label-secondary">
        {note}
      </span>
    </button>
  );
}

function SettingsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { settings, setSettings } = useData();
  const method = METHOD_BY_ID[settings.method];

  return (
    <Sheet open={open} onClose={onClose} title="Timer settings">
      <div className="space-y-4">
        {method.countUp && (
          <p
            className="rounded-control p-3 text-footnote"
            style={{ background: "var(--fill-quaternary)" }}
          >
            Flowtime counts up, so the focus length is set by you stopping. The
            break is about a fifth of what you just worked.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Focus minutes">
            <input
              type="number"
              min={1}
              max={180}
              inputMode="numeric"
              className={inputClass}
              style={inputStyle}
              value={settings.focus_min}
              disabled={method.countUp}
              onChange={(e) =>
                setSettings({
                  method: "custom",
                  focus_min: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </Field>
          <Field label="Break minutes">
            <input
              type="number"
              min={1}
              max={60}
              inputMode="numeric"
              className={inputClass}
              style={inputStyle}
              value={settings.short_break_min}
              onChange={(e) =>
                setSettings({
                  method: "custom",
                  short_break_min: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </Field>
          <Field label="Long break minutes">
            <input
              type="number"
              min={1}
              max={120}
              inputMode="numeric"
              className={inputClass}
              style={inputStyle}
              value={settings.long_break_min}
              onChange={(e) =>
                setSettings({
                  method: "custom",
                  long_break_min: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </Field>
          <Field label="Rounds before long break">
            <input
              type="number"
              min={1}
              max={10}
              inputMode="numeric"
              className={inputClass}
              style={inputStyle}
              value={settings.rounds_before_long}
              onChange={(e) =>
                setSettings({
                  rounds_before_long: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </Field>
        </div>

        <Field label="Daily focus goal" hint="Minutes">
          <input
            type="number"
            min={15}
            step={15}
            inputMode="numeric"
            className={inputClass}
            style={inputStyle}
            value={settings.daily_goal_min}
            onChange={(e) =>
              setSettings({
                daily_goal_min: Math.max(15, Number(e.target.value) || 15),
              })
            }
          />
        </Field>

        <div
          className="divide-y overflow-hidden rounded-card"
          style={{ background: "var(--grouped-secondary)" }}
        >
          <Toggle
            label="Start breaks automatically"
            checked={settings.auto_start_breaks}
            onChange={(v) => setSettings({ auto_start_breaks: v })}
          />
          <Toggle
            label="Chime when a block ends"
            checked={settings.chime}
            onChange={(v) => setSettings({ chime: v })}
          />
        </div>

        <p className="text-footnote text-label-secondary">
          Keyboard: space starts and pauses, R resets the block, S skips ahead.
        </p>
      </div>
    </Sheet>
  );
}
