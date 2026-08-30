"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { cloudEnabled, getSupabase } from "./supabase";
import {
  DEFAULT_SETTINGS,
  type Session,
  type Settings,
  type Task,
} from "./types";

const TASK_KEY = "lockin.tasks.v1";
const SESSION_KEY = "lockin.sessions.v1";
const SETTINGS_KEY = "lockin.settings.v1";

export type SyncState =
  | "off" // no Supabase keys configured; local-only
  | "signed-out"
  | "syncing"
  | "synced"
  | "error";

interface Row {
  id: string;
  updated_at: string;
  deleted_at: string | null;
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing or a full quota — the in-memory state still works. */
  }
}

/**
 * Last-write-wins per row, compared on updated_at. Good enough for a personal
 * planner: the only conflicts are the same person on two devices, and the
 * newer edit is virtually always the one they meant to keep.
 */
function merge<T extends Row>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const row of local) byId.set(row.id, row);
  for (const row of remote) {
    const mine = byId.get(row.id);
    if (!mine || new Date(row.updated_at) > new Date(mine.updated_at)) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

/** Rows the server is missing or has an older copy of. */
function outbound<T extends Row>(merged: T[], remote: T[]): T[] {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  return merged.filter((row) => {
    const theirs = remoteById.get(row.id);
    return !theirs || new Date(row.updated_at) > new Date(theirs.updated_at);
  });
}

const now = () => new Date().toISOString();
const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface DataContextValue {
  ready: boolean;
  tasks: Task[];
  sessions: Session[];
  settings: Settings;
  user: User | null;
  sync: SyncState;
  syncError: string | null;
  lastSyncedAt: number | null;

  addTask: (patch: Partial<Task> & { title: string }) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  logFocus: (
    taskId: string | null,
    label: string,
    seconds: number,
    route?: string | null,
  ) => void;
  logBreak: (seconds: number) => void;
  setSettings: (patch: Partial<Settings>) => void;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [user, setUser] = useState<User | null>(null);
  const [sync, setSync] = useState<SyncState>(cloudEnabled ? "signed-out" : "off");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Latest state for the debounced pusher, which must not re-subscribe on
  // every keystroke.
  const latest = useRef({ tasks, sessions });
  useEffect(() => {
    latest.current = { tasks, sessions };
  }, [tasks, sessions]);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --- Load from disk once on mount ------------------------------------- */
  // Loading after mount is what keeps the server and client markup identical;
  // reading localStorage during render would cause a hydration mismatch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTasks(readLocal<Task[]>(TASK_KEY, []));
    setSessions(readLocal<Session[]>(SESSION_KEY, []));
    setSettingsState({
      ...DEFAULT_SETTINGS,
      ...readLocal<Partial<Settings>>(SETTINGS_KEY, {}),
    });
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* --- Persist locally on every change ---------------------------------- */
  useEffect(() => {
    if (ready) writeLocal(TASK_KEY, tasks);
  }, [tasks, ready]);
  useEffect(() => {
    if (ready) writeLocal(SESSION_KEY, sessions);
  }, [sessions, ready]);
  useEffect(() => {
    if (ready) writeLocal(SETTINGS_KEY, settings);
  }, [settings, ready]);

  /* --- Auth ------------------------------------------------------------- */
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  /* --- Full two-way sync ------------------------------------------------ */
  const syncNow = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    setSync("syncing");
    setSyncError(null);
    try {
      const [taskRes, sessionRes] = await Promise.all([
        sb.from("tasks").select("*").eq("user_id", user.id),
        sb.from("sessions").select("*").eq("user_id", user.id),
      ]);
      if (taskRes.error) throw taskRes.error;
      if (sessionRes.error) throw sessionRes.error;

      const remoteTasks = (taskRes.data ?? []) as Task[];
      const remoteSessions = (sessionRes.data ?? []) as Session[];

      const mergedTasks = merge(latest.current.tasks, remoteTasks);
      const mergedSessions = merge(latest.current.sessions, remoteSessions);

      setTasks(mergedTasks);
      setSessions(mergedSessions);

      const taskUp = outbound(mergedTasks, remoteTasks).map((t) => ({
        ...t,
        user_id: user.id,
      }));
      const sessionUp = outbound(mergedSessions, remoteSessions).map((s) => ({
        ...s,
        user_id: user.id,
      }));

      if (taskUp.length) {
        const { error } = await sb.from("tasks").upsert(taskUp);
        if (error) throw error;
      }
      if (sessionUp.length) {
        const { error } = await sb.from("sessions").upsert(sessionUp);
        if (error) throw error;
      }

      setSync("synced");
      setLastSyncedAt(Date.now());
    } catch (err) {
      setSync("error");
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    }
  }, [user]);

  // Sync on sign-in, when the tab regains focus, and when we come back online.
  useEffect(() => {
    if (!user) {
      // Mirrors the Supabase auth subscription, which is an external system.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSync(cloudEnabled ? "signed-out" : "off");
      return;
    }
    void syncNow();
    const onFocus = () => void syncNow();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [user, syncNow]);

  /** Push changed rows shortly after an edit settles. */
  const schedulePush = useCallback(() => {
    if (!user) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void syncNow(), 1200);
  }, [user, syncNow]);

  useEffect(() => {
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, []);

  /* --- Mutations -------------------------------------------------------- */
  const addTask = useCallback(
    (patch: Partial<Task> & { title: string }) => {
      const stamp = now();
      const task: Task = {
        id: newId(),
        title: patch.title,
        notes: patch.notes ?? "",
        category: patch.category ?? "homework",
        course: patch.course ?? "",
        due_at: patch.due_at ?? null,
        priority: patch.priority ?? 0,
        estimate_min: patch.estimate_min ?? null,
        done: false,
        completed_at: null,
        focus_sec: 0,
        created_at: stamp,
        updated_at: stamp,
        deleted_at: null,
      };
      setTasks((prev) => [task, ...prev]);
      schedulePush();
      return task;
    },
    [schedulePush],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...patch, updated_at: now() } : t,
        ),
      );
      schedulePush();
    },
    [schedulePush],
  );

  const toggleTask = useCallback(
    (id: string) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const done = !t.done;
          return {
            ...t,
            done,
            completed_at: done ? now() : null,
            updated_at: now(),
          };
        }),
      );
      schedulePush();
    },
    [schedulePush],
  );

  const deleteTask = useCallback(
    (id: string) => {
      const stamp = now();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, deleted_at: stamp, updated_at: stamp } : t,
        ),
      );
      schedulePush();
    },
    [schedulePush],
  );

  const logFocus = useCallback(
    (
      taskId: string | null,
      label: string,
      seconds: number,
      route: string | null = null,
    ) => {
      if (seconds < 30) return; // ignore accidental starts
      const stamp = now();
      const session: Session = {
        id: newId(),
        task_id: taskId,
        label,
        started_at: new Date(Date.now() - seconds * 1000).toISOString(),
        duration_sec: Math.round(seconds),
        kind: "focus",
        route,
        created_at: stamp,
        updated_at: stamp,
        deleted_at: null,
      };
      setSessions((prev) => [session, ...prev]);
      if (taskId) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  focus_sec: t.focus_sec + Math.round(seconds),
                  updated_at: stamp,
                }
              : t,
          ),
        );
      }
      schedulePush();
    },
    [schedulePush],
  );

  const logBreak = useCallback(
    (seconds: number) => {
      if (seconds < 30) return;
      const stamp = now();
      setSessions((prev) => [
        {
          id: newId(),
          task_id: null,
          label: "Break",
          started_at: new Date(Date.now() - seconds * 1000).toISOString(),
          duration_sec: Math.round(seconds),
          kind: "break",
          route: null,
          created_at: stamp,
          updated_at: stamp,
          deleted_at: null,
        },
        ...prev,
      ]);
      schedulePush();
    },
    [schedulePush],
  );

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
  }, []);

  const liveTasks = useMemo(
    () => tasks.filter((t) => !t.deleted_at),
    [tasks],
  );
  const liveSessions = useMemo(
    () => sessions.filter((s) => !s.deleted_at),
    [sessions],
  );

  const value: DataContextValue = {
    ready,
    tasks: liveTasks,
    sessions: liveSessions,
    settings,
    user,
    sync,
    syncError,
    lastSyncedAt,
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    logFocus,
    logBreak,
    setSettings,
    syncNow,
    signOut,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
