# PROLLY — Roadmap Status

Tracked using the status system defined in the master roadmap
(⬜ NOT STARTED · 🟡 IN PROGRESS · 🟠 BLOCKED · 🔵 NEEDS TESTING ·
🟢 COMPLETE · 🔴 FAILED/NEEDS REWORK).

---

### TASK 001 — Repository audit
STATUS: 🟢 COMPLETE
PRIORITY: 🔴 P0 (Phase 1)
FILES: entire repo (see PROJECT_ARCHITECTURE.md for full file-by-file detail)
DEPENDENCIES: none
WHAT WAS CHANGED: no code changed — audit only
HOW IT WAS TESTED: n/a (read-only analysis)
RESULT: `PROJECT_ARCHITECTURE.md` produced. Key findings: `app/prollys/[id]/page.tsx`
is an orphaned, unlinked route with hardcoded fake data; no duplicate-join
protection exists anywhere; three incompatible `UserRole` definitions
exist across `lib/prolly-store.ts`, `lib/access-control.ts` (dead,
unimported), and `lib/role-store.ts` (the one actually used); admin
auth is checked two different, inconsistent ways; profile/favorites are
global-per-browser, not per-wallet; zero GenLayer client wiring exists in
the frontend; 4 dead files identified (`app/page.backup.tsx`,
`app/prollys/page.backup.tsx`, `lib/access-control.ts`,
`lib/genlayer-network-fix.js`). Also found: prior session transcript's
claimed "Stage 1" work (contract wiring, sponsor dashboard rebuild, etc.)
does not exist in this repository.
NEXT TASK: P0 implementation (see below)

---

### TASK 004 — Lint/build verification
STATUS: 🟢 COMPLETE
PRIORITY: 🔴 P0 (Phase 2, verification only)
FILES: whole project (`npm run lint`, `npm run build`)
DEPENDENCIES: none
WHAT WAS CHANGED: nothing — verification only, run by the user on the
real Ubuntu dev environment (this sandbox has no network/`node_modules`
and could not run these itself)
HOW IT WAS TESTED: `npm run lint`, `npm run build`
RESULT: lint — 0 errors, 10 warnings. build — PASS, TypeScript
compilation PASS, all routes generated successfully.
NEXT TASK: treat the 10 lint warnings as cleanup items resolved alongside
their related architectural changes below, not as a standalone task.

**Project status: technically buildable, not yet production-ready** —
core business logic (duplicate-join protection, wallet identity, role
consolidation, GenLayer contract wiring) remains incomplete per the
Task 001 audit.

---

### TASK 011 — P0 implementation planning
STATUS: 🔵 NEEDS APPROVAL (plan written, no code changed)
PRIORITY: 🔴 P0
FILES: none changed — plan only, see `P0_IMPLEMENTATION_PLAN.md`
DEPENDENCIES: TASK 001
WHAT WAS CHANGED: nothing
HOW IT WAS TESTED: n/a
RESULT: Concrete plan produced for all four P0 items (duplicate
participation protection, wallet-based identity, UserRole consolidation,
GenLayer contract boundary), each with current implementation, exact
problem, files involved, proposed architecture, data flow, dependencies,
security implications, testing strategy, and localStorage migration
implications. Five open decisions flagged for your call before
implementation begins (see end of `P0_IMPLEMENTATION_PLAN.md`).
NEXT TASK: awaiting approval + answers to the 5 open decisions before
any P0 code changes are made.

---

### TASK 012 — P0-1/P0-2/P0-3 implementation
STATUS: 🔵 NEEDS TESTING (implemented, syntax-sanity-checked, NOT run
through real `npm run lint`/`npm run build`/browser testing — this
sandbox has no network/`node_modules`, same limitation as Task 004)
PRIORITY: 🔴 P0
FILES:
- NEW `lib/wallet-identity.ts` — shared `normalizeAddress()`
- MODIFIED `lib/profile-store.ts` — per-wallet keys, legacy migration+clear
- MODIFIED `lib/favorite-store.ts` — same treatment (found to be unused
  anywhere in `app/` while doing this — flagging for P2 dead-file review)
- MODIFIED `lib/prolly-store.ts` — participant-list migration (snap to 0),
  `hasWalletJoined()`, `addParticipant()`, dropped duplicate `UserRole`
  export
- MODIFIED `lib/role-store.ts` — local `normalize()` now aliases the
  shared `normalizeAddress()`
- MODIFIED `app/prollys/page.tsx` — wallet-gated join, duplicate-join
  check, `participantList` actually populated
- MODIFIED `app/profile/page.tsx` — wallet-scoped profile load/save,
  form gated on connection, corrected stale "wallet auth coming later" copy
- MODIFIED `app/admin/page.tsx` — `handleCreate()` now derives
  `creatorUsername` from the connected admin's profile/address instead of
  hardcoded `"boma"`
DEPENDENCIES: TASK 011 (plan approval)
WHAT WAS CHANGED: see files above; full diffs available on request,
changed files packaged as `p0-changes.zip`
HOW IT WAS TESTED: manual code review + a crude brace/paren-balance sanity
check via Node (not a real TypeScript compile). **Not run**: `npm run
lint`, `npm run build`, or any browser/manual click-through — no
`node_modules`/network in this sandbox. Needs to happen on your machine
before this is trusted as working.
RESULT: implementation complete per the approved plan and locked
decisions. P0-4 explicitly NOT implemented — remains blocked on a
confirmed `gltest` pass against a live localnet, per your decision.
CORRECTION TO TASK 001: that audit incorrectly stated
`app/admin/page.tsx` "doesn't call [`getRole()`] at all, it inlines its
own check." It does already call `getRole()` (line 119) — that claim was
wrong and is corrected here.
NEXT TASK: run lint/build/manual testing (see test plan below), report
results back; then P1 items per your original ordering; P0-4 whenever a
confirmed `gltest` pass exists.

---

### Not yet started (P1 / P2, per your ordering)

⬜ Resolve the `/prollys/[id]` route architecture
⬜ Consolidate admin/access-control architecture (broader cleanup beyond
   P0-3's type/function consolidation)
⬜ Define the authoritative Prolly data model
⬜ Define the complete Prolly lifecycle
⬜ Remove/archive dead files (`app/page.backup.tsx`,
   `app/prollys/page.backup.tsx`, `lib/access-control.ts`,
   `lib/genlayer-network-fix.js`) — deliberately held until their
   replacements are confirmed working, per your explicit ordering
