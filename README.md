# Task Manager

A multi-user task/list manager built for a technical assessment: lists with Kanban and list views, dependency-aware task scheduling, a per-task timer with calendar-aware time accounting, notifications, attachments, comments, activity logging, version rollback, and CSV/PDF/Excel export.

## Stack

- **Next.js 16** (App Router, Route Handlers, Server Components) — see `AGENTS.md`, this is a newer major version with real API differences from the version most tooling was trained on
- **TypeScript**, strict mode
- **Redux Toolkit + RTK Query** for server-state (notifications, comments, activity, task updates) — the rest of the UI uses local React state
- **Zod** for schema validation, shared between client and server
- **Tailwind CSS + shadcn/ui** (`shared/ui/*`) built on `@base-ui/react` primitives
- **Vitest + Testing Library** for tests (2000+ tests)
- File-backed persistence (see below) — no external database

## Architecture

Layered, roughly Clean-Architecture-shaped:

```
entities/   pure domain logic + Zod schemas + repositories (schema, model, repository)
features/   one use case each — permission checks, mutations, hooks, RTK Query slices
widgets/    composed UI sections (dialogs, boards, detail panels)
app/        Next.js routes: pages (Server Components) + API route handlers
shared/     cross-cutting: UI primitives, the Redux store, db access, utilities
```

- `entities/*/model.ts` holds business logic as pure functions (priority calculation, dependency cycles, calendar-aware elapsed time, notification thresholds, rollback reconstruction) — this is deliberately not split into a separate `/domain` folder; the split is architectural, not physical.
- `entities/*/repository.ts` is the only layer that touches persistence.
- `features/*` wraps a repository/model call behind a permission check (`canViewList`/`canEditList`) and exposes either a server-side "for user" function (used by API routes) or a client hook.
- API routes under `app/api/**` are thin: auth → permission-checked feature call → JSON response.

## Requirements

- Node.js >= 20.9 (matches Next.js 16's own engine requirement)
- npm (the repo ships a `package-lock.json`; no yarn/pnpm lockfile)

## Getting started

```bash
npm install
npm run dev       # http://localhost:3000
```

```bash
npm run build      # production build (next build)
npm start           # serve the production build
npm test            # vitest run
npm run test:watch  # vitest --watch
npx tsc --noEmit     # type check
npm run lint         # eslint
npx knip              # unused files/exports/deps
```

## Demo credentials

Seeded in `data.json`:

| Email | Password | Notes |
|---|---|---|
| `admin@example.com` | `Admin123!` | owns most seed lists |
| `user@example.com` | `User123!` | has shared access to some of admin's lists |
| `guest@example.com` | `Guest123!` | limited/read-only access, useful for permission testing |

Passwords are stored as `demo:<plaintext>` hashes (`entities/user/*`) — a stand-in for real hashing (e.g. bcrypt), acceptable for a local demo but **not production-safe**.

## Persistence and runtime state

There is no external database. All application data is file-backed JSON:

- `data.json` — the seed dataset (users, lists, tasks), checked into the repo, validated against the Zod schemas on load.
- `.local-state/db.json` — the live runtime database. On first read it's seeded from `data.json`; every mutation reads, updates, and rewrites this file (`shared/lib/db.ts`). It's gitignored — deleting it resets the app back to the seed data.
- `.local-state/attachments/<taskId>/<attachmentId>` — uploaded file bytes, stored on disk by server-generated id (not by filename, to avoid path traversal).
- Sessions are also file-backed (`shared/lib/session-store`), for the same reason as `db.ts`: Next.js runs Route Handlers, Server Components, and the proxy in separate module graphs, so an in-memory singleton wouldn't be shared between them.

Writes go through a write-temp-then-rename step, so a crash mid-write can't corrupt the file — but there's no cross-process locking, so concurrent writers can race. This is fine for a single local Node process at demo scale; it is not a substitute for a real datastore under load.

## Demo environment limitations

- **Not deployable as-is to serverless platforms** (Vercel, Netlify Functions, etc.) — the filesystem those runtimes give each invocation is ephemeral and not shared across instances, so `.local-state/db.json`, session data, and uploaded attachments would not persist or stay consistent between requests. Running this app for real needs either a long-lived Node process with a persistent volume, or migrating persistence to an actual database/object storage — see "Deployment" below.
- Deadline/time-threshold notifications are delivered by in-app polling (every 15s) while a tab is open — there's no push mechanism (email, web push) for a closed tab.
- The "other users' changes" notification setting only synchronizes tabs of the *same browser* via `BroadcastChannel`; cross-device consistency still relies on the same 15s poll, not a websocket.
- Session history shows an IP address, but in this local/demo setup it's a fixed placeholder value, not a real client IP.
- Passwords use a demo-only hashing scheme (see above).

## Authentication & sessions

Email/password login (`features/auth/login-form.tsx`) with real-time validation and a loading state. Sessions are cookie-based and file-backed; the login history/sessions view (`widgets/settings/sessions-section.tsx`) lists device/IP/time per session, with a "log out everywhere" action that revokes all of a user's sessions at once. A shared `getCurrentSession` check (used identically by the proxy and by API routes) rejects revoked sessions everywhere.

## Key features

- **Lists**: create (from a template), edit (with history), soft-delete + restore (30-day window), duplicate, sharing (read-only / edit access per collaborator), search/filter with saved & recent filters, CSV/PDF export.
- **Tasks**: rich fields, dependencies (`dependsOn`) with cycle detection and cascading status updates, subtasks with parent progress roll-up, soft-delete + restore, clone-with-modification, auto-generated `TEST-N` codes that backfill gaps left by deletions.
- **Kanban board**: drag-and-drop status changes (`features/task/use-kanban-board.ts`) go through the same update path as a manual edit, so dependency/cascade rules apply identically either way. Includes per-column empty state, an in-flight save indicator, and an aggregate error banner for a failed move — all sourced from the same client-side mutation state used to disable/re-enable the drag handle.
- **Smart Priority**: `entities/task/model.ts:calculatePriority` combines deadline proximity, dependency chain position, user-set priority, and historical time-on-similar-tasks into one score, shown alongside the raw priority.
- **Completion Prediction**: `entities/task/completion-prediction.ts` projects a finish time from the same calendar-aware elapsed-time engine and historical-task provider used by Smart Priority.
- **Timer**: start/pause/resume/stop, persisted across reloads; elapsed time is calculated live from `workDayHours` (a calendar-aware engine that only counts working hours), not stored as a running counter.
- **Inline editing & autosave**: task fields save individually with a manual debounce (400ms), optimistic UI update, and rollback on a failed request; Escape cancels only the field being edited (without propagating to the surrounding dialog) and reverts it to its last committed value.
- **Attachments**: upload/download/delete per task, with ownership checks tying every attachment to its task (no id-substitution access). Upload and delete each record an Activity Log entry.
- **Activity Log**: a per-task audit trail (field changes, status changes, comments, attachments, rollbacks, timer actions) — `entities/activity/*`, fetched via RTK Query and invalidated automatically after any action that should refresh it, so the log updates live without reopening the task.
- **Version rollback**: reconstructs a task's prior state from its history and previews the diff before applying it, gated by the same edit-permission check as any other mutation.
- **Comments**: per-task, edit-access gated; `%1h%` / `%30m%` in a comment text extends the task's time estimate and is recorded in both history and the activity log.
- **Notifications**: time-threshold alerts (75/90/100% of estimate) and list-deadline reminders (15/10/5 min), delivered by polling `/api/notifications` (server-computed, deduplicated against per-user acked keys). Two settings toggles have real effect: enabling *work-hours recalculation* shows an on-screen confirmation after a `workDayHours` change is saved; enabling *other users' changes* opens a `BroadcastChannel` so sibling tabs of the same browser refresh their notifications immediately on a dismiss instead of waiting for the next poll (see "Demo environment limitations").
- **Export**: list-level CSV (client-side) and PDF (server-rendered); task-level CSV, PDF, and Excel — every export endpoint re-checks list/task view permissions server-side.
- **Error boundary**: `shared/ui/ErrorBoundary.tsx` is mounted once around the routed page content (`app/app-error-boundary.tsx`, wired in `app/layout.tsx`), so a render error anywhere in a page shows an accessible retry UI instead of a blank screen, without turning the whole app into a client component.

## Redux Toolkit + RTK Query

State management is Redux Toolkit; server-state (notifications, comments, task updates, activity) is RTK Query, chosen for cache invalidation and optimistic updates rather than hand-rolled fetch/loading/error state per hook. `shared/store/*` holds the store setup; each feature slice lives next to its feature (e.g. `features/comment/comments-api.ts`). Not every mutation has been migrated — attachments, timer actions, Kanban drag/drop, and rollback still use plain `fetch` wrappers, which was a deliberate scoping decision (see `docs/` for the underlying design notes) rather than an oversight.

## Deployment

This app is **not currently deployed**. Locally, `npm run build` succeeds and `npm start` serves the production build correctly, but the file-backed persistence described above makes a plain deploy to Vercel/Netlify's serverless functions unsafe — data would silently reset or diverge between invocations. Shipping a real deployment would require either:

- a single persistent Node process (e.g. a small VM or a platform's "always-on" container) with a writable, persistent volume for `.local-state/`, or
- migrating `shared/lib/db.ts` and the attachment store to an actual database and object storage, which is out of scope for this assessment.
