"use client";

import { useRef, useState } from "react";
import { useData } from "@/lib/store";
import { cloudEnabled, getSupabase } from "@/lib/supabase";
import {
  Button,
  Field,
  ListGroup,
  cx,
  inputClass,
  inputStyle,
} from "@/components/ui";
import { CloudIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";

export default function AccountPage() {
  const { user, sync, syncError, lastSyncedAt, syncNow, signOut, tasks, sessions } =
    useData();

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-24 md:pb-10">
      <PageHeader
        title="Account"
        subtitle="Sign in to use the same planner on your laptop and your phone."
      />

      <SyncCard
        state={sync}
        error={syncError}
        lastSyncedAt={lastSyncedAt}
        email={user?.email ?? null}
      />

      {!cloudEnabled ? (
        <NotConfigured />
      ) : user ? (
        <div className="mt-5 space-y-3">
          <Button block onClick={() => void syncNow()}>
            Sync now
          </Button>
          <Button block variant="tinted" tint="var(--red)" onClick={() => void signOut()}>
            Sign out
          </Button>
          <p className="px-1 text-footnote text-label-secondary">
            Signing out leaves this device&rsquo;s copy in place. Your data stays
            in the cloud and comes back when you sign in again.
          </p>
        </div>
      ) : (
        <AuthForm />
      )}

      <BackupCard tasks={tasks.length} sessions={sessions.length} />
    </div>
  );
}

function SyncCard({
  state,
  error,
  lastSyncedAt,
  email,
}: {
  state: string;
  error: string | null;
  lastSyncedAt: number | null;
  email: string | null;
}) {
  const copy: Record<string, { title: string; note: string; color: string }> = {
    off: {
      title: "This device only",
      note: "Everything is saved in this browser. Add Supabase keys to sync.",
      color: "var(--label-tertiary)",
    },
    "signed-out": {
      title: "Not signed in",
      note: "Your work is saved here. Sign in to sync it everywhere.",
      color: "var(--orange)",
    },
    syncing: {
      title: "Syncing",
      note: "Merging this device with the cloud.",
      color: "var(--blue)",
    },
    synced: {
      title: "Synced",
      note: lastSyncedAt
        ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}.`
        : "Up to date.",
      color: "var(--green)",
    },
    error: {
      title: "Sync problem",
      note: error ?? "Something went wrong.",
      color: "var(--red)",
    },
  };
  const c = copy[state] ?? copy.off;

  return (
    <div
      className="flex items-start gap-3 rounded-card p-4"
      style={{ background: "var(--grouped-secondary)" }}
    >
      <span className="mt-0.5 text-[22px]" style={{ color: c.color }}>
        <CloudIcon />
      </span>
      <div className="min-w-0">
        <p className="text-headline font-semibold">{c.title}</p>
        <p className="text-footnote text-label-secondary">{c.note}</p>
        {email && (
          <p className="mt-0.5 truncate text-footnote text-label-tertiary">
            {email}
          </p>
        )}
      </div>
    </div>
  );
}

function AuthForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setMessage(null);
    setIsError(false);
    try {
      const res =
        mode === "in"
          ? await sb.auth.signInWithPassword({ email, password })
          : await sb.auth.signUp({ email, password });
      if (res.error) throw res.error;
      if (mode === "up" && !res.data.session) {
        setMessage("Check your email to confirm the account, then sign in.");
      }
      setPassword("");
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div
        className="inline-flex w-full gap-1 rounded-control p-1"
        style={{ background: "var(--fill-tertiary)" }}
      >
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cx(
              "min-h-[36px] flex-1 rounded-[7px] text-subheadline transition",
              mode === m ? "font-semibold" : "font-medium text-label-secondary",
            )}
            style={
              mode === m
                ? {
                    background: "var(--grouped-secondary)",
                    boxShadow: "var(--shadow-sm)",
                  }
                : undefined
            }
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <Field label="Email">
        <input
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          style={inputStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field
        label="Password"
        hint={mode === "up" ? "At least 6 characters." : undefined}
      >
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className={inputClass}
          style={inputStyle}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {message && (
        <p
          role="status"
          className="text-footnote"
          style={{ color: isError ? "var(--red)" : "var(--green)" }}
        >
          {message}
        </p>
      )}

      <Button type="submit" variant="filled" block disabled={busy}>
        {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

function NotConfigured() {
  return (
    <ListGroup
      className="mt-5"
      header="Turn on sync"
      footer="Until then everything is saved in this browser and stays on this device."
    >
      <div className="space-y-2 px-4 py-3 text-footnote text-label-secondary">
        <p>
          Create a free Supabase project, run the SQL in{" "}
          <code>supabase/schema.sql</code>, then set these two environment
          variables in Vercel and redeploy:
        </p>
        <pre
          className="overflow-x-auto rounded-control p-3 text-caption"
          style={{ background: "var(--fill-quaternary)" }}
        >
          <code>
            NEXT_PUBLIC_SUPABASE_URL{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>
        </pre>
      </div>
    </ListGroup>
  );
}

function BackupCard({
  tasks,
  sessions,
}: {
  tasks: number;
  sessions: number;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  const exportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      tasks: JSON.parse(localStorage.getItem("lockin.tasks.v1") ?? "[]"),
      sessions: JSON.parse(localStorage.getItem("lockin.sessions.v1") ?? "[]"),
      settings: JSON.parse(localStorage.getItem("lockin.settings.v1") ?? "{}"),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lockin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      if (!Array.isArray(data.tasks)) throw new Error("No tasks in that file");
      localStorage.setItem("lockin.tasks.v1", JSON.stringify(data.tasks));
      if (Array.isArray(data.sessions)) {
        localStorage.setItem("lockin.sessions.v1", JSON.stringify(data.sessions));
      }
      if (data.settings) {
        localStorage.setItem("lockin.settings.v1", JSON.stringify(data.settings));
      }
      setNote("Imported. Reloading…");
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  return (
    <ListGroup
      className="mt-8"
      header="Backup"
      footer={`${tasks} tasks and ${sessions} focus sessions on this device.`}
    >
      <div className="flex flex-wrap gap-2 px-4 py-3">
        <Button onClick={exportData}>Export JSON</Button>
        <Button onClick={() => fileInput.current?.click()}>Import JSON</Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importData(f);
            e.target.value = "";
          }}
        />
      </div>
      {note && (
        <p role="status" className="px-4 pb-3 text-footnote text-label-secondary">
          {note}
        </p>
      )}
    </ListGroup>
  );
}
