# Traceability (end-to-end) — Spec & Implementation Plan

**Stream:** Trazabilidad de punta a punta.
**Owner of:** `src/app/api/traceability/**`, a debug page, `src/lib/traceability.ts`, and the
traceability section of `DECISIONS.md`.

> **For agentic workers:** steps use checkbox (`- [ ]`) syntax. Executed inline in this session.

**Goal:** Demonstrate that a **single query** over `events` reconstructs a user's full journey
`login → search → scrape → click → favorite`, exposed via a protected API endpoint and a legible
debug page.

**Architecture:** The `events` table already carries everything needed (`user_id`, `session_id`,
`type`, `payload` JSONB, `created_at`). Reconstruction is therefore a **read-only** concern:
one `SELECT ... WHERE user_id = $1 ORDER BY created_at ASC`, then a pure function that normalizes
each row into a human-readable timeline step and groups steps by `session_id`. No schema changes;
we only define (and document) the **payload contract per `EventType`** so every producer stream
emits fields the reconstruction can link on.

**Tech Stack:** Next.js 16 App Router (RSC + Route Handler), Prisma 7 (`prisma.event.findMany`),
Supabase SSR for the auth gate, TypeScript.

## Global Constraints

- Do NOT modify `prisma/schema.prisma` or `prisma/migrations/` (schema frozen, shared DB).
- Additive only outside my folders; do NOT touch `layout.tsx` / `globals.css` / `middleware.ts`.
- `payload` is JSONB and flexible — new correlation fields live inside `payload`, never new columns.
- Convention: JS-native **camelCase** keys inside `payload` (Prisma fields are camelCase). The
  design doc's `snake_case` sketch (`result_count`) was illustrative; canonical contract is camelCase.
  The reader is defensive and also accepts the snake_case variants.
- All must pass before done: `npm run lint`, `npm run typecheck`, `npm run format:check`.

---

## Payload contract (the coordination deliverable)

One canonical shape per `EventType`, so the timeline is reconstructible and steps link together.
Correlation keys: `session_id` (column) groups a journey; `searchId` ties `SEARCH ↔ SCRAPE`;
`externalId` ties `CLICK ↔ FAVORITE_*`.

| Type              | payload (canonical camelCase)                                                        |
| ----------------- | ------------------------------------------------------------------------------------ |
| `LOGIN`           | `{ method?: string, email?: string }`                                                |
| `SEARCH`          | `{ query: string, comuna?: string, searchId?: string, filters?: object }`            |
| `SCRAPE`          | `{ source, status, resultCount, durationMs, httpStatus?, query?, searchId?, error?}` |
| `CLICK`           | `{ externalId, url, title? }`                                                        |
| `FAVORITE_ADD`    | `{ externalId, url, title?, price? }`                                                |
| `FAVORITE_REMOVE` | `{ externalId, url?, title? }`                                                       |

These are exported as TypeScript types + builder helpers so producer streams (scraper, favorites,
auth) can emit conforming payloads. Adoption by those streams is a follow-up; the reader tolerates
missing/partial fields regardless.

---

## File Structure

- Create `src/lib/traceability.ts` — read-side: payload contract types + builders, the single-query
  runner `getUserTimeline`, and the pure `reconstructTimeline` + `describeEvent`. Exports the raw
  SQL string `TRACEABILITY_SQL` for docs/UI.
- Create `src/app/api/traceability/route.ts` — protected GET endpoint returning `{ query, events,
timeline }` as JSON.
- Create `src/app/debug/traceability/page.tsx` — server component rendering the timeline legibly,
  grouped by session, with a "seed demo journey" server action.
- Create `src/app/debug/traceability/actions.ts` — the `seedDemoJourney` server action.
- Create `scripts/verify-traceability.ts` — standalone assert+demo: seeds a synthetic journey via
  `logEvent`, runs the single query, asserts the reconstruction, prints the timeline.
- Modify `DECISIONS.md` — expand section 2's traceability note into a full, evaluator-ready section.

---

## Task 1: Read-side library (`src/lib/traceability.ts`)

**Files:** Create `src/lib/traceability.ts`. Test via `scripts/verify-traceability.ts` (Task 4).

**Interfaces:**

- Consumes: `prisma` from `@/lib/prisma`; `EventType` from `@/generated/prisma/client`;
  `logEvent` from `@/lib/events` (builders are optional sugar over it).
- Produces:
  - `TRACEABILITY_SQL: string` — the literal single query.
  - `getUserTimeline(userId: string): Promise<UserTimeline>` — runs the one query, returns
    `{ userId, query, events: RawEvent[], sessions: TimelineSession[] }`.
  - `reconstructTimeline(events: RawEvent[]): TimelineSession[]` — pure grouping/normalization.
  - `describeEvent(e: RawEvent): TimelineStep` — pure per-row human label.
  - Payload types `LoginPayload | SearchPayload | ScrapePayload | ClickPayload | FavoritePayload`
    and builder helpers `searchPayload(...)`, `scrapePayload(...)`, `clickPayload(...)`,
    `favoritePayload(...)`.

- [ ] **Step 1:** Write `TRACEABILITY_SQL` constant and `getUserTimeline` using
      `prisma.event.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })` (compiles to the
      single SELECT). Comment the raw-SQL equivalence.
- [ ] **Step 2:** Write pure `describeEvent` — switch on `type`, read payload defensively
      (camelCase first, snake_case fallback), return `{ id, at, type, icon, label, detail, correlationKey }`.
- [ ] **Step 3:** Write pure `reconstructTimeline` — group rows by `sessionId` (null → `"no-session"`),
      keep chronological order within and across sessions, map each via `describeEvent`.
- [ ] **Step 4:** Add payload types + builder helpers.
- [ ] **Step 5:** `npm run typecheck` passes.

## Task 2: Protected API endpoint (`src/app/api/traceability/route.ts`)

**Files:** Create `src/app/api/traceability/route.ts`.

**Interfaces:**

- Consumes: `getUserTimeline`, `TRACEABILITY_SQL` from `@/lib/traceability`; `createClient` from
  `@/lib/supabase/server`.
- Produces: `GET` handler.

**Access model (documented decision):**

- **Self mode:** valid Supabase session → returns the current user's timeline (ignores `userId`).
- **Debug mode:** `?userId=<uuid>` + header `x-debug-secret` (or `?secret=`) equal to
  `process.env.CRON_SECRET` → returns that user's timeline. Disabled when `CRON_SECRET` is empty.
- Neither → `401`.

- [ ] **Step 1:** Implement the handler with the access model above; validate `userId` is a UUID;
      return `{ query, count, sessions, events }` JSON.
- [ ] **Step 2:** `npm run typecheck` passes.

## Task 3: Debug page + seed action

**Files:** Create `src/app/debug/traceability/page.tsx`, `src/app/debug/traceability/actions.ts`.

- [ ] **Step 1:** `actions.ts` — `seedDemoJourney()` server action: resolves current user (or a
      fixed demo UUID when unauthenticated, so it works before the auth stream lands), emits
      `LOGIN → SEARCH → SCRAPE → CLICK → FAVORITE_ADD` via `logEvent` sharing one `sessionId`, returns
      the userId used.
- [ ] **Step 2:** `page.tsx` — server component: resolves target userId (session, else `?userId=`
      with secret, else the demo UUID), calls `getUserTimeline`, renders sessions/steps as a legible
      vertical timeline; shows `TRACEABILITY_SQL`; includes the seed button (form → server action).
- [ ] **Step 3:** `npm run typecheck` passes.

## Task 4: Verification script + runtime check

**Files:** Create `scripts/verify-traceability.ts`. Add `tsx` devDep + `verify:traceability` script.

- [ ] **Step 1:** Script seeds a synthetic journey (random UUID userId, no auth needed — `events`
      has no cross-schema FK) via `logEvent`, runs `getUserTimeline`, asserts: exactly 5 steps, order
      is `LOGIN,SEARCH,SCRAPE,CLICK,FAVORITE_ADD`, `SEARCH.searchId === SCRAPE.searchId`,
      `CLICK.externalId === FAVORITE_ADD.externalId`. Prints the reconstructed timeline. Exits non-zero
      on any assertion failure.
- [ ] **Step 2:** Run it — expect PASS and a printed timeline.
- [ ] **Step 3:** Runtime browser check via `next-dev-loop`: set a local `CRON_SECRET`, start dev,
      open `/debug/traceability`, click "seed demo journey", confirm the timeline renders; hit
      `/api/traceability?userId=<uuid>&secret=<CRON_SECRET>` and confirm JSON.
- [ ] **Step 4:** `git` cleanup of any seeded rows is unnecessary (synthetic user), note in PR.

## Task 5: DECISIONS.md traceability section

- [ ] **Step 1:** Replace the brief note in section 2 with a full evaluator-ready subsection: the
      exact query, why one query suffices (append-only spine + indexed `(user_id, created_at)`), the
      payload contract table, correlation keys, the endpoint/debug-page access model, and how it was
      verified.

## Final gate

- [ ] `npm run lint` && `npm run typecheck` && `npm run format:check` all pass.
- [ ] Commit per logical task; push branch; open PR against `main`.

## Self-review notes

- Spec coverage: single query ✅ (Task 1/`TRACEABILITY_SQL`), endpoint ✅ (Task 2), debug page ✅
  (Task 3), payload coordination ✅ (contract + builders), DECISIONS ✅ (Task 5), verification ✅
  (Task 4).
- No schema change: reconstruction is read-only; correlation lives in `payload`. ✅
- Decoupled from unfinished streams: debug mode + demo UUID let this run before auth/scraper land. ✅
