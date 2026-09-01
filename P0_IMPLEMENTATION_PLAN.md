# PROLLY — P0 Implementation Plan

Status: **APPROVED. Decisions locked in. P0-1, P0-2, P0-3 implemented
this session; P0-4 remains blocked pending a confirmed `gltest` pass
against a live localnet (per your own decision below) — not implemented.**
Written against the verified state in `PROJECT_ARCHITECTURE.md`
(commit `0edd3aa`).

Ordering note: P0-1 (duplicate participation) structurally depends on
P0-2 (wallet identity) — you can't detect a duplicate wallet if nothing
tracks wallets yet. Implemented in dependency order: P0-2 first, then
P0-1, then P0-3. P0-4 not started.

## Locked decisions (superseding the "Open decisions" list at the end)

1. **P0-1**: legacy/non-wallet participant counts are snapped to `0` at
   migration, not preserved. The old drifted numbers are not authoritative
   and the UI must not keep showing them post-migration.
2. **P0-2**: per-wallet `localStorage` keys, not one address-keyed JSON
   blob.
3. **P0-2**: old global profile/favorites data is migrated into the
   currently-connected wallet's per-address keys where safe, then the old
   global keys are cleared so they can never again influence per-wallet
   state.
4. **P0-3**: `getRole()` stays in `role-store.ts`. No new `lib/roles.ts`.
5. **P0-4**: blocked until a confirmed `gltest` pass against a live
   localnet exists. The confirmed test output — not assumption — defines
   the exact contract boundary (methods, args, return values, tx
   behavior, participant storage, duplicate-enforcement, error/rejection
   behavior) before any frontend integration code is written.

**Required end-state architecture (governs P0-4 once unblocked, and
frames why P0-1/P0-2 are explicitly interim):**
```
Connected wallet
  → frontend wallet-aware UX/duplicate check   (P0-1/P0-2, THIS session — UX guard only)
  → GenLayer contract validation                (P0-4, BLOCKED — not this session)
  → authoritative participant record             (P0-4, BLOCKED — not this session)
```
The contract, not `localStorage`, must ultimately be the source of truth
for "1 wallet = 1 opportunity." Clearing `localStorage`, switching
browsers, or switching devices must not let the same wallet bypass a
contract-level restriction. Nothing implemented this session achieves
that yet — it can't, until P0-4 unblocks — and this plan does not claim
otherwise.

---

## P0-1: Duplicate participation protection

**Current implementation.** `app/prollys/page.tsx`'s `joinProlly()`
increments `prolly.participants` (a plain number) directly. The
`Participant` type and `Prolly.participantList` field exist in
`lib/prolly-store.ts` but are never written to anywhere. The join modal
in this file has **no wallet-connection requirement at all** — confirmed
by grep, there is no `useAccount`/wagmi import in `app/prollys/page.tsx`.
"Confirm & Join" works with no wallet connected.

**Exact problem.** Nothing stops one visitor — wallet connected or not —
from clicking "Confirm & Join" repeatedly. There is no record of *who*
joined, only a count. This directly breaks the roadmap's own stated rule
("one user = one entry unless rules say otherwise").

**Files involved.** `app/prollys/page.tsx` (join handler + modal),
`lib/prolly-store.ts` (`Prolly`/`Participant` types, `shouldCloseProlly`/
`hasReachedParticipantLimit`).

**Proposed architecture.**
- Gate the join button on wallet connection (same `useAccount` pattern
  already used in `WalletButton.tsx` and `app/admin/page.tsx`) — no
  wallet connected → button prompts connect, doesn't open the confirm
  modal.
- On confirm: normalize the connected address, check it against
  `participantList` entries' `walletAddress`; if already present, block
  with a clear message instead of proceeding.
- Actually populate `participantList` on join: push `{ id, walletAddress,
  username, joinedAt: Date.now() }`.
- Make the displayed `participants` count **derived** from
  `participantList.length` rather than an independently incremented
  number, so the two can't drift apart from each other.

**Data flow.** `useAccount()` → address → normalize → check membership in
`prolly.participantList` → if absent, append `Participant` → `saveProllys()`
→ re-render from updated store.

**Dependencies.** Requires P0-2's wallet-identity work to exist first (a
stable, normalized identity key). Loosely touches P0-3 for whatever
`username` gets displayed on the participant record.

**Security implications.** This remains a **client-side, localStorage-only**
guard — someone can still clear or hand-edit their own browser storage to
remove their entry and rejoin. That's an inherent limit of the current
architecture, not something this item alone can close. The durable fix is
the contract's own `join()` / `joined` TreeMap check (already implemented
in `contracts/prolly.py`), which takes over once P0-4 actually wires
joining through the chain. I'm flagging this explicitly so this item isn't
mistaken for a security fix — it's a correctness/UX fix for the prototype,
and real enforcement lives in P0-4's scope.

**Testing strategy** (manual — no frontend test runner exists in this repo
currently, no Jest/Vitest/Playwright config found): join with wallet A →
succeeds, list has 1 entry; retry with wallet A → blocked, list unchanged;
join with wallet B → succeeds, list has 2; attempt join with no wallet
connected → button doesn't allow it; reach `maxParticipants` → still shows
"Prolly Full" as today; displayed count always equals `participantList.length`.

**Migration implications for existing localStorage data — LOCKED: option
(b).** Existing Prollys (including `defaultProllys`) have a numeric
`participants` with no `participantList`. On load, any Prolly missing
`participantList` gets `participantList: []` **and** `participants`
snapped to `0` (i.e. `participantList.length`), overwriting whatever
drifted number was there. This is a one-time, one-directional migration —
old counts are not preserved anywhere, per your instruction that they're
not authoritative. The UI reads `participants` straight from the migrated
store, so it will not continue showing pre-migration numbers.

**Expected final behavior.** A given wallet can join a given Prolly at
most once, enforced client-side as an interim guard until P0-4 lands;
displayed participant counts are always accurate to the tracked list.

---

## P0-2: Wallet-based user identity

**Current implementation.** `lib/profile-store.ts` stores exactly one
global `UserProfile { username, createdAt, updatedAt }` under a single
fixed `localStorage` key, with zero relationship to which wallet is
connected — confirmed, no `useAccount`/wagmi import in
`app/profile/page.tsx` either. `lib/favorite-store.ts` is the same
pattern (one global favorites list). Meanwhile wallet-address-as-identity
*is* already used elsewhere, inconsistently: `role-store.ts`'s
`SponsorApplication.walletAddress`, and `admin/page.tsx`'s direct
`useAccount()` + env-var comparison.

**Exact problem.** Switching connected wallets in the same browser
doesn't switch "who you are" for profile/favorites — the same profile and
favorites persist regardless of address. Everything downstream that needs
identity to mean something (duplicate-join protection, "my participation
history", sponsor status per-address) needs this to be reliable first.

**Files involved.** `lib/profile-store.ts`, `lib/favorite-store.ts`,
`app/profile/page.tsx`, and (new) a small shared `lib/wallet-identity.ts`.

**Proposed architecture.**
- New shared helper `lib/wallet-identity.ts` exporting
  `normalizeAddress(address: string): string` (lowercase) — consolidates
  the near-identical `normalize()`/`normalizeWallet()` functions currently
  duplicated separately in `role-store.ts` and `access-control.ts`.
- `loadProfile()`/`saveProfile()`/`clearProfile()` (and the equivalent
  favorite-store functions) take a required `walletAddress` parameter.
  Storage becomes address-scoped — **LOCKED: per-address keys**
  (`prolly-user-profile:${normalizedAddress}`,
  `prolly-favorites:${normalizedAddress}`), not one combined JSON map.
- When no wallet is connected, profile/favorites are simply unavailable —
  extending the same `mounted`/connection-guard pattern already used
  elsewhere in the app, not introducing a new UI paradigm.

**Data flow.** `useAccount()` → address → `normalizeAddress()` → key used
for every profile/favorites/participant lookup and write.

**Dependencies.** Prerequisite for P0-1. Feeds P0-3 (role should also
resolve from the same normalized address).

**Security implications.** This is client-side identity, not
cryptographic proof of key ownership — we're reading whatever
`useAccount().address` the connected wallet extension reports, which is
the standard trust model for this kind of read (not a signature
challenge). The real security boundary is wherever value actually moves —
the GenLayer contract requiring a signed transaction — not this storage
layer. Worth stating plainly so it isn't mistaken for authentication.

**Testing strategy.** Connect wallet A, set username "alice" → confirm
stored under A's key. Disconnect, connect wallet B → confirm no profile
shown (fresh), set "bob". Reconnect A → confirm "alice" reappears
unchanged. Repeat for favorites.

**Migration implications — LOCKED.** The existing single global
profile/favorites has no known owning address. On first load post-change:
if the old global key exists and the currently-connected wallet has no
per-address entry yet, copy the old global value in as that wallet's
initial profile/favorites (one-time, one-directional). Immediately after
that copy, the old global key is **deleted** — per your instruction, it
must not be left around to influence any wallet's state later (e.g. a
second wallet connecting later must not also inherit it once it's already
been claimed once).

**Expected final behavior.** Profile and favorites are scoped to the
connected wallet; switching wallets shows that wallet's own data, not the
previous one's.

---

## P0-3: Consolidate the three `UserRole` definitions

**Current implementation.** Three separate `UserRole` type declarations:
`lib/prolly-store.ts` and `lib/access-control.ts` both declare
`"user" | "sponsor" | "admin"` (identical, duplicated); `lib/role-store.ts`
declares `"user" | "sponsor_pending" | "sponsor" | "admin"` (a superset,
and the one actually exercised — `app/sponsor/page.tsx` calls its
`getRole()`). Separately, admin status is checked two different ways:
`access-control.ts`'s `isAdmin()`/`ADMIN_WALLETS` (dead — unimported
anywhere, confirmed by grep) vs. `app/admin/page.tsx`'s own inline
`address === process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS` check (the one
that actually runs).

**Exact problem.** No single function anywhere authoritatively answers
"what is this wallet's role." `role-store.ts`'s `getRole()` is the closest
thing and is used by the sponsor page, but the admin page doesn't call it
— it inlines a separate check. Two independently-maintained answers to
the same question can silently diverge.

**Files involved.** `lib/prolly-store.ts` (drop its `UserRole` export in
favor of the canonical one), `lib/access-control.ts` (delete — as its own
P2 commit per your ordering, not bundled here), `lib/role-store.ts`
(becomes the canonical home), `app/admin/page.tsx` (switch to calling
`getRole()` instead of its inline check), `app/admin/page.tsx`'s
Prolly-creation code (`creatorRole` currently hardcoded to `"admin"`).

**Proposed architecture.**
- One canonical type: `role-store.ts`'s existing
  `"user" | "sponsor_pending" | "sponsor" | "admin"` — it's a strict
  superset of the other two, nothing is lost standardizing on it.
- One canonical function: the existing `getRole(walletAddress,
  adminAddress)`, **staying in `role-store.ts` — LOCKED, no new
  `lib/roles.ts`.**
- `app/admin/page.tsx` calls this instead of its inline comparison.
- `role-store.ts`'s local `normalize()` switches to the shared
  `normalizeAddress()` from P0-2, removing that duplication too.
- `Prolly.creatorRole` is set from this canonical result at creation time
  instead of the current hardcoded `"admin"`.

**Data flow.** `useAccount()` → address → `getRole(address,
NEXT_PUBLIC_ADMIN_WALLET_ADDRESS)` → single `UserRole` → drives admin gate,
sponsor gate, and `creatorRole` assignment consistently.

**Dependencies.** Uses P0-2's `normalizeAddress`. Feeds your P1 item
"consolidate admin/access-control architecture" (this item is the
type/function consolidation; that P1 item is the broader cleanup +
remaining call sites).

**Security implications.** Still a client-side env-var comparison —
consolidating removes the risk of the two checks disagreeing, but doesn't
change the underlying trust model. Moving admin authorization on-chain is
already flagged in the roadmap and in the prototype's own comments as
future work, out of scope here.

**Testing strategy.** Non-admin, non-sponsor wallet → role `"user"`
consistently from both admin and sponsor pages. Submit sponsor
application → `"sponsor_pending"`. Approve via admin → `"sponsor"`.
Connect the admin wallet → `"admin"`, admin panel accessible. Create a
Prolly as admin → confirm `creatorRole` on the saved record is computed,
not hardcoded.

**Migration implications.** None for existing data — `creatorRole`'s
shape (`"admin" | "sponsor"`) doesn't change, only how future creations
compute the value.

**Expected final behavior.** One `UserRole` type, one function computing
it, used consistently everywhere role matters.

---

## P0-4: Establish the real frontend ↔ GenLayer contract boundary

**Current implementation.** None. `genlayer-js` (`^1.1.8`) is installed at
the root but imported nowhere in `app/` or `lib/` (confirmed by grep). All
Prolly state — creation, joining, closing — lives entirely in
`localStorage`. `contracts/prolly.py` has real join/close/reveal/
winner-selection logic as of last session, but has never been deployed or
tested against a live node from this workspace.

**Exact problem.** There's no seam between "the app" and "the chain" —
not a broken one, an absent one. Deciding that boundary's shape now
avoids redesigning it per-feature later.

**Files involved.** New: `lib/genlayer-client.ts`, `lib/prolly-contract.ts`.
Touched minimally: `lib/prolly-store.ts` (one additive optional field).

**Proposed architecture.**
- `lib/genlayer-client.ts`: wraps `genlayer-js` client creation, pointed
  at a network chosen via a new env var
  (`NEXT_PUBLIC_GENLAYER_RPC_URL`), defaulting to whatever
  `lib/wagmi.ts` currently hardcodes for hosted Studio, but overridable —
  this directly addresses the audit's "wired to hosted Studio only" gap
  without removing Studio support.
- `lib/prolly-contract.ts`: one typed wrapper function per contract public
  method — `join`, `hasJoined`, `getParticipantCount`,
  `closeAndCommitRevealRound`, `revealAndSelectWinners`, `getWinners`,
  `getVerificationMaterial` — each a thin, faithful mirror of
  `contracts/prolly.py`'s interface. No business logic beyond
  encode/send/decode.
- **Explicitly not in this item's scope:** switching `app/admin/page.tsx`
  or `app/prollys/page.tsx` over to actually call these functions instead
  of localStorage. That's real UI/data-flow work for a deliberate later
  phase, once this boundary is confirmed working against a real deployed
  contract — building the bridge and routing traffic onto it are separate
  steps, and routing traffic is exactly the kind of change your
  instructions say to hold off on for now.
- `Prolly.contractAddress?: string` — one new optional field, additive,
  non-breaking; existing localStorage-only Prollys just leave it undefined.

**Data flow** (once wired in a later phase, not this one): admin creates
Prolly → contract deployed via `genlayer-js` → `contractAddress` stored on
the record → join/close/reveal calls route through
`lib/prolly-contract.ts` using that address → results reflected in UI.

**Dependencies — LOCKED, hard blocker.** Requires a confirmed `gltest`
pass against a live localnet before any of this is implemented. That has
not happened yet from this workspace (no localnet/network access here).
Per your explicit instruction, nothing in `lib/genlayer-client.ts` /
`lib/prolly-contract.ts` gets written until that confirmation exists —
the confirmed test output is what defines the real method signatures,
argument shapes, return values, transaction behavior, participant
storage, duplicate-enforcement behavior, and error/rejection behavior.
**This item was not started this session for that reason.**

**Security implications.** This is where real security starts to matter
(money can eventually move here). The wrapper layer should do basic
input sanity checks before sending transactions (empty participant
strings, non-positive winner counts) as defense-in-depth — the contract
already validates these too, this doesn't replace that. No private keys
or secrets belong in this layer; signing stays with the connected wallet
via wagmi, unchanged.

**Testing strategy.** Once genuinely deployed to a reachable localnet:
exercise each `lib/prolly-contract.ts` wrapper against that real
deployment — mocks would hide exactly the class of bug (calldata/API-shape
mismatch) that caused the original version-skew problem. No TS test
runner exists in this repo yet (no Jest/Vitest config found); worth a
decision on whether to add one now or test via a scratch script first.

**Migration implications.** None — additive only, doesn't touch how
existing Prollys are read/written/displayed.

**Expected final behavior.** A real, tested code path exists for calling
every public method of the deployed Prolly contract — available for the
next phase to wire into actual UI flows, while today's localStorage UI
keeps working unchanged in the meantime.

---

## Decisions — all resolved (see locked-decisions list at top)

Superseded — kept here only as a record of what was originally open.
Final answers are in "Locked decisions" at the top of this document.

## Implementation order (this session)

1. `lib/wallet-identity.ts` — new, shared `normalizeAddress()`.
2. `lib/profile-store.ts` — per-wallet keys + one-time migration/clear.
3. `lib/favorite-store.ts` — same treatment.
4. `lib/prolly-store.ts` — participant-list migration (snap to 0),
   `participants` becomes derived from `participantList.length`.
5. `app/prollys/page.tsx` — wallet-gated join, duplicate-join check,
   populate `participantList`.
6. `app/profile/page.tsx` — pass connected wallet address through to the
   now-wallet-scoped profile store.
7. `role-store.ts` — switch its local `normalize()` to the shared
   `normalizeAddress()`.
8. `app/admin/page.tsx` — call `getRole()` instead of its inline admin
   check; `creatorRole` computed instead of hardcoded.
9. P0-4 — **not started, blocked** per locked decision 5.
