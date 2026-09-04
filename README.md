# Lock In

A planner for coursework, projects and studying, with a focus timer built in.

Local-first: everything saves instantly to your browser and works offline. Sign
in and it syncs across every device you use.

## What's in it

**Planner** — tasks grouped into Overdue / Today / Tomorrow / This week / Later,
with type (homework, studying, projects, personal), class, due date, priority,
time estimate, and logged focus time. Quick-add on one line, full editor when you
need it.

**Calendar** — week and month views. Tap a day's number to add something due
then. Anything without a date sits in a tray underneath: **drag it onto a day
to set its deadline**, and drag anything already on the grid to another day to
move it. Works with a mouse or a finger. A plain tap opens the task instead, so
nothing is lost to a mis-grab. The grid is always drawn, even with nothing
scheduled, because an empty calendar is exactly when you need somewhere to drop
things.

**Ideas** — a bubble map for brainstorming, on a live physics canvas. Bubbles
repel each other, branches hang off their parent on springs, and everything
drifts gently when left alone. Double-tap the board for a new bubble, Enter to
branch off the selected one, drag to rearrange. Colour steps along the palette
with each level, so depth reads at a glance. Any bubble can become a project in
the planner — it takes the root bubble as its class, so a branch keeps the
theme it came from. Deleting takes the whole branch with it.

**Import** — pull a whole term in at once from Schoology or Google Calendar.

- Paste an `.ics` feed, drop in an exported `.ics` file, or just copy a list of
  assignments off any page — every line with a date in it becomes a task.
- Each event is previewed before anything is created: edit the title, set the
  class, change the type. Nothing is added until you say so.
- It guesses the type from the wording (quiz/exam → studying, essay/project →
  projects, no school/assembly → personal) and pulls the class out of shapes
  like `AP Biology: Lab writeup` or `Problem set 7 (Calculus BC)`.
- Anything already in your planner is flagged and unticked, so you can re-import
  an updated feed without doubling everything up.
- Repeating events are left out by default — they're usually class periods
  rather than work — but there's a checkbox if you want them.

**Lock In** — the focus timer.

- **Methods**, each with its real provenance:
  - **Pomodoro** 25/5. The 25 wasn't from a study — Cirillo landed on it by
    trial and error in the late 1980s. What holds up is that a short commitment
    is easy to start.
  - **52/17**, from DeskTime's 2014 analysis of its most productive 10% of
    users, who drifted into that rhythm on their own.
  - **Deep work** 90/20, built on the ~90 minute ultradian cycle.
  - **Flowtime** — counts up instead of down. Work until focus actually breaks,
    then rest about a fifth of what you put in.
  - **Custom**.
- **Random flight** — the block becomes a real route. You take off when the
  timer starts, the aircraft tracks across the arc with live altitude and
  distance, and you land when it ends. With *random route* on, the destination
  stays hidden until touchdown. Completed flights collect in a flight log.
- **Scenes** — the Monterey Bay jelly cam, moon jellies, and two ISS Earth
  feeds, plus browser-synthesised brown noise, rain, and cabin roar. The sound
  is generated locally, so it needs no network and never goes offline.
- **Lock in full screen** — takes over the display, scene playing behind the
  clock. Counts how many times you tabbed away.
- Space starts and pauses, `R` resets, `S` skips. The countdown shows in the tab
  title, and the timer keeps running while you move around the app.

**Stats** — streak, this week, all time, a two-week bar chart against your daily
goal, a breakdown of where the time actually went by class, and the flight log.

## Running it locally

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. It works fully with no accounts and no database —
data lives in your browser.

## Turning on sync across devices

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase **SQL Editor**, paste all of `supabase/schema.sql` and Run.
3. In **Project Settings → API**, copy the *Project URL* and the *anon public*
   key.
4. Put them in `.env.local` (copy `.env.example` first):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

5. Restart `npm run dev`, open **Account**, and create an account.

Already set this up before the Ideas board existed? Re-run `schema.sql` — it's
safe to run again and adds the `ideas` table. Until you do, brainstorms simply
stay on the device that made them; tasks keep syncing as normal.

Optional: under **Authentication → Sign In / Providers → Email**, turn off
"Confirm email" so you can sign in immediately without the confirmation step.

The anon key is meant to be public. Row Level Security, which `schema.sql` turns
on, is what actually keeps your rows private — every policy checks
`auth.uid() = user_id`.

## How sync works

Every change writes to `localStorage` first, so the UI never waits on the
network. A sync runs on sign-in, when the tab regains focus, when you come back
online, and about a second after you stop editing. Rows merge last-write-wins on
`updated_at`, and deletes are soft (`deleted_at`) so a deletion on your laptop
doesn't reappear from your phone.

Timer preferences stay on the device they were set on.

## Notes

Design follows Apple's Human Interface Guidelines: semantic color tokens with
light and dark variants driven by the system appearance, the system type scale,
44pt minimum hit targets, translucent materials that fall back to opaque under
`prefers-reduced-transparency`, and honored `prefers-reduced-motion`.

Built with Next.js 16, React 19, Tailwind v4, and Supabase.
