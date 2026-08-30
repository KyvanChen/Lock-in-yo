"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useData } from "./store";
import { formatClock } from "./date";
import { flowtimeBreakSec } from "./methods";
import { pickRoute, routeKey, type Route } from "./flights";

export type Phase = "focus" | "short" | "long";

const STATE_KEY = "lockin.timer.v2";

interface FlightState extends Route {
  blind: boolean;
}

interface Persisted {
  phase: Phase;
  taskId: string | null;
  running: boolean;
  /** Epoch ms the current countdown ends at. Meaningful only while running. */
  endsAt: number | null;
  /** Seconds left, authoritative while paused. */
  leftSec: number;
  /** Length of the current block in seconds. Zero while counting up. */
  durationSec: number;
  /** Banked count-up seconds, held across pauses. */
  elapsedSec: number;
  /** Epoch ms the current count-up run began. */
  startedAt: number | null;
  /** Completed focus blocks in the current cycle. */
  round: number;
  /** Times the tab lost focus during this block. */
  distractions: number;
  flight: FlightState | null;
  /** True between touchdown and the start of the next block. */
  arrived: boolean;
}

const INITIAL: Persisted = {
  phase: "focus",
  taskId: null,
  running: false,
  endsAt: null,
  leftSec: 25 * 60,
  durationSec: 25 * 60,
  elapsedSec: 0,
  startedAt: null,
  round: 0,
  distractions: 0,
  flight: null,
  arrived: false,
};

interface TimerContextValue extends Persisted {
  /** True while the focus block counts up instead of down (Flowtime). */
  countUp: boolean;
  /** Seconds remaining. Zero for a count-up focus block. */
  remaining: number;
  /** Seconds worked so far in this block. */
  elapsed: number;
  /** 0-1 through the block. Always 0 while counting up. */
  progress: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setPhase: (phase: Phase) => void;
  setTaskId: (id: string | null) => void;
  locked: boolean;
  setLocked: (v: boolean) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function chime(kind: "done" | "break") {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const notes = kind === "done" ? [660, 880, 1320] : [880, 660];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    });
    setTimeout(() => void ctx.close(), 1600);
  } catch {
    /* Audio is a nicety; a blocked AudioContext must not break the timer. */
  }
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") new Notification(title, { body });
  } catch {
    /* ignore */
  }
}

/** Seconds worked so far in a block, measured against a caller-supplied clock. */
function workedIn(s: Persisted, isCountUp: boolean, ts: number): number {
  if (isCountUp) {
    return s.elapsedSec + (s.startedAt ? (ts - s.startedAt) / 1000 : 0);
  }
  const left = s.running ? Math.max(0, ((s.endsAt ?? 0) - ts) / 1000) : s.leftSec;
  return s.durationSec - left;
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { settings, tasks, logFocus, logBreak } = useData();

  const [state, setState] = useState<Persisted>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [locked, setLocked] = useState(false);
  // The wall clock is state, not a Date.now() call in the render body, so
  // rendering stays pure and the compiler can memoize safely.
  const [nowTs, setNowTs] = useState(0);

  // Read through a ref so the tick loop never needs rebuilding. Assigned in an
  // effect rather than during render.
  const live = useRef({ logFocus, logBreak, settings, tasks });
  useEffect(() => {
    live.current = { logFocus, logBreak, settings, tasks };
  }, [logFocus, logBreak, settings, tasks]);

  const countUp = settings.method === "flowtime" && state.phase === "focus";

  const lengthFor = useCallback(
    (phase: Phase) => {
      const s = settings;
      if (phase === "focus") {
        return s.method === "flowtime" ? 0 : s.focus_min * 60;
      }
      return (phase === "long" ? s.long_break_min : s.short_break_min) * 60;
    },
    [settings],
  );

  /* --- Restore an in-progress block across reloads and navigations ------ */
  useEffect(() => {
    let restored: Persisted | null = null;
    try {
      const raw = window.localStorage.getItem(STATE_KEY);
      if (raw) restored = { ...INITIAL, ...(JSON.parse(raw) as Persisted) };
    } catch {
      /* fall through to defaults */
    }
    // Reading the saved block out of localStorage after mount is what keeps the
    // server and client markup identical.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (restored) setState(restored);
    setNowTs(Date.now());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const remaining = countUp
    ? 0
    : state.running
      ? Math.max(0, ((state.endsAt ?? 0) - nowTs) / 1000)
      : state.leftSec;

  const elapsed = countUp
    ? state.elapsedSec +
      (state.running && state.startedAt ? (nowTs - state.startedAt) / 1000 : 0)
    : state.durationSec - remaining;

  /* --- Countdown reaching zero ------------------------------------------ */
  const complete = useCallback(
    (ts: number) => {
      setState((s) => {
        const cfg = live.current.settings;
        if (s.phase === "focus") {
          const task = live.current.tasks.find((t) => t.id === s.taskId) ?? null;
          live.current.logFocus(
            s.taskId,
            task?.title ?? "Focus",
            s.durationSec,
            s.flight ? `${s.flight.from}-${s.flight.to}` : null,
          );
          const round = s.round + 1;
          const nextPhase: Phase =
            round % cfg.rounds_before_long === 0 ? "long" : "short";
          const nextLen =
            (nextPhase === "long" ? cfg.long_break_min : cfg.short_break_min) *
            60;
          if (cfg.chime) chime("done");
          notify(
            s.flight ? `Landed in ${s.flight.toCity}` : "Focus block done",
            `Take ${Math.round(nextLen / 60)} minutes.`,
          );
          return {
            ...s,
            phase: nextPhase,
            round,
            durationSec: nextLen,
            leftSec: nextLen,
            elapsedSec: 0,
            startedAt: null,
            running: cfg.auto_start_breaks,
            endsAt: cfg.auto_start_breaks ? ts + nextLen * 1000 : null,
            distractions: 0,
            arrived: Boolean(s.flight),
          };
        }

        live.current.logBreak(s.durationSec);
        const nextLen = lengthFor("focus");
        if (cfg.chime) chime("break");
        notify("Break over", "Back to it.");
        return {
          ...s,
          phase: "focus",
          durationSec: nextLen,
          leftSec: nextLen,
          elapsedSec: 0,
          startedAt: null,
          running: false,
          endsAt: null,
          distractions: 0,
          flight: null,
          arrived: false,
        };
      });
    },
    [lengthFor],
  );

  /* --- Tick -------------------------------------------------------------- */
  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => {
      const ts = Date.now();
      setNowTs(ts);
      if (!countUp && ((state.endsAt ?? 0) - ts) / 1000 <= 0) complete(ts);
    }, 250);
    return () => clearInterval(id);
  }, [state.running, state.endsAt, countUp, complete]);

  /* --- Count tab-aways during a focus block ------------------------------ */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setState((s) =>
          s.running && s.phase === "focus"
            ? { ...s, distractions: s.distractions + 1 }
            : s,
        );
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* --- Countdown in the tab title ---------------------------------------- */
  useEffect(() => {
    if (!hydrated) return;
    const base = "Lock In";
    document.title = state.running
      ? `${formatClock(countUp ? elapsed : remaining)} · ${
          state.phase === "focus" ? "Focus" : "Break"
        }`
      : base;
    return () => {
      document.title = base;
    };
  }, [state.running, state.phase, remaining, elapsed, countUp, hydrated]);

  /* --- Controls ---------------------------------------------------------- */
  const start = useCallback(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
    const ts = Date.now();
    setNowTs(ts);
    setState((s) => {
      const cfg = live.current.settings;
      const isCountUp = cfg.method === "flowtime" && s.phase === "focus";

      if (isCountUp) {
        return {
          ...s,
          running: true,
          startedAt: ts,
          endsAt: null,
          arrived: false,
          flight: null,
        };
      }

      // Board a flight if one is called for and we are at the top of a block.
      let flight = s.flight;
      if (cfg.flight_mode && s.phase === "focus" && !flight && s.durationSec > 0) {
        flight = { ...pickRoute(Math.round(s.durationSec / 60)), blind: cfg.flight_blind };
      }

      return {
        ...s,
        running: true,
        endsAt: ts + s.leftSec * 1000,
        flight,
        arrived: false,
      };
    });
  }, []);

  const pause = useCallback(() => {
    const ts = Date.now();
    setNowTs(ts);
    setState((s) => {
      if (!s.running) return s;
      const cfg = live.current.settings;
      if (cfg.method === "flowtime" && s.phase === "focus") {
        return {
          ...s,
          running: false,
          startedAt: null,
          elapsedSec:
            s.elapsedSec + (s.startedAt ? (ts - s.startedAt) / 1000 : 0),
        };
      }
      return {
        ...s,
        running: false,
        endsAt: null,
        leftSec: Math.max(0, ((s.endsAt ?? 0) - ts) / 1000),
      };
    });
  }, []);

  /** Abandon the block, banking whatever focus time was accrued. */
  const reset = useCallback(() => {
    const ts = Date.now();
    setNowTs(ts);
    setState((s) => {
      const cfg = live.current.settings;
      const isCountUp = cfg.method === "flowtime" && s.phase === "focus";
      const worked = workedIn(s, isCountUp, ts);
      if (s.phase === "focus" && worked > 0) {
        const task = live.current.tasks.find((t) => t.id === s.taskId) ?? null;
        live.current.logFocus(
          s.taskId,
          task?.title ?? "Focus",
          worked,
          s.flight ? `${s.flight.from}-${s.flight.to}` : null,
        );
      }
      const len = lengthFor(s.phase);
      return {
        ...s,
        running: false,
        endsAt: null,
        startedAt: null,
        elapsedSec: 0,
        durationSec: len,
        leftSec: len,
        distractions: 0,
        flight: null,
        arrived: false,
      };
    });
  }, [lengthFor]);

  /** Move to the next block, banking accrued focus time. */
  const skip = useCallback(() => {
    const ts = Date.now();
    setNowTs(ts);
    setState((s) => {
      const cfg = live.current.settings;
      const isCountUp = cfg.method === "flowtime" && s.phase === "focus";

      if (s.phase === "focus") {
        const worked = workedIn(s, isCountUp, ts);
        if (worked > 0) {
          const task = live.current.tasks.find((t) => t.id === s.taskId) ?? null;
          live.current.logFocus(
            s.taskId,
            task?.title ?? "Focus",
            worked,
            s.flight ? `${s.flight.from}-${s.flight.to}` : null,
          );
        }
        const round = s.round + 1;
        // Flowtime earns a break proportional to the stretch just worked.
        const nextPhase: Phase = isCountUp
          ? "short"
          : round % cfg.rounds_before_long === 0
            ? "long"
            : "short";
        const nextLen = isCountUp
          ? flowtimeBreakSec(worked)
          : (nextPhase === "long" ? cfg.long_break_min : cfg.short_break_min) *
            60;
        return {
          ...s,
          phase: nextPhase,
          round,
          durationSec: nextLen,
          leftSec: nextLen,
          elapsedSec: 0,
          startedAt: null,
          running: false,
          endsAt: null,
          distractions: 0,
          arrived: Boolean(s.flight),
        };
      }

      const nextLen = lengthFor("focus");
      return {
        ...s,
        phase: "focus",
        durationSec: nextLen,
        leftSec: nextLen,
        elapsedSec: 0,
        startedAt: null,
        running: false,
        endsAt: null,
        distractions: 0,
        flight: null,
        arrived: false,
      };
    });
  }, [lengthFor]);

  const setPhase = useCallback(
    (phase: Phase) => {
      const len = lengthFor(phase);
      setState((s) => ({
        ...s,
        phase,
        durationSec: len,
        leftSec: len,
        elapsedSec: 0,
        startedAt: null,
        running: false,
        endsAt: null,
        distractions: 0,
        flight: null,
        arrived: false,
      }));
    },
    [lengthFor],
  );

  const setTaskId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, taskId: id }));
  }, []);

  // Adopt new lengths when the method or durations change, but never disturb a
  // block that is already running.
  useEffect(() => {
    if (!hydrated) return;
    // Settings live in a sibling provider, so this effect is the sync point
    // between them.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => {
      if (s.running) return s;
      const len = lengthFor(s.phase);
      if (len === s.durationSec) return s;
      return { ...s, durationSec: len, leftSec: len, elapsedSec: 0 };
    });
  }, [settings, lengthFor, hydrated]);

  const value: TimerContextValue = {
    ...state,
    countUp,
    remaining,
    elapsed,
    progress:
      countUp || state.durationSec <= 0
        ? 0
        : Math.max(0, Math.min(1, 1 - remaining / state.durationSec)),
    start,
    pause,
    reset,
    skip,
    setPhase,
    setTaskId,
    locked,
    setLocked,
  };

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside <TimerProvider>");
  return ctx;
}

export { routeKey };
