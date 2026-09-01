#!/usr/bin/env bash
set -euo pipefail
# Run this from the ROOT of your real Prolly repo (~/projects/prolly).
# It recreates the exact P0 files from the Claude workspace, byte for byte.
# Nothing else in your repo is touched. Review with git diff after running.
echo "Applying P0 changes..."

mkdir -p "lib"
cat > "lib/wallet-identity.ts" << 'PROLLY_P0_EOF'
/**
 * Single shared definition of what "the same wallet" means across the
 * app. Every store that keys data by wallet address (profile, favorites,
 * Prolly participation, role resolution) should normalize through this
 * function so two different callers never disagree on identity because
 * of casing.
 *
 * NOTE: this is a client-side normalization convenience only. It does not
 * verify wallet ownership (no signature challenge) — see
 * P0_IMPLEMENTATION_PLAN.md P0-2 "Security implications" for why that's
 * an acceptable/expected boundary here, and P0-4 for where the real
 * ownership check eventually lives (the connected wallet signing an
 * actual contract transaction).
 */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}
PROLLY_P0_EOF
echo "  wrote lib/wallet-identity.ts"

mkdir -p "lib"
cat > "lib/profile-store.ts" << 'PROLLY_P0_EOF'
import { normalizeAddress } from "@/lib/wallet-identity";

export type UserProfile = {
  username: string;
  createdAt: number;
  updatedAt: number;
};

// Legacy, pre-wallet-identity key. No longer written to. Only read once,
// by migrateLegacyProfile(), to carry forward whatever was there before
// profile became wallet-scoped -- then deleted so it can't be read again.
const LEGACY_PROFILE_STORAGE_KEY = "prolly-user-profile";

function profileStorageKey(walletAddress: string): string {
  return `prolly-user-profile:${normalizeAddress(walletAddress)}`;
}

/**
 * One-time, one-directional migration: if the old global profile key
 * still exists and this wallet doesn't have its own profile yet, adopt
 * the old value as this wallet's profile, then delete the old global key
 * so it can never be read again (by this wallet or any other one that
 * connects later).
 */
function migrateLegacyProfile(walletAddress: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const legacy = localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);

  if (!legacy) {
    return;
  }

  const key = profileStorageKey(walletAddress);
  const alreadyHasOwnProfile = localStorage.getItem(key) !== null;

  if (!alreadyHasOwnProfile) {
    try {
      // Validate it's actually a usable profile before adopting it.
      JSON.parse(legacy) as UserProfile;
      localStorage.setItem(key, legacy);
    } catch {
      // Corrupt legacy data -- nothing worth migrating.
    }
  }

  // Either migrated above, or another wallet already claimed it, or it
  // was corrupt -- in every case the legacy key must not persist.
  localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
}

export function loadProfile(walletAddress: string): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  migrateLegacyProfile(walletAddress);

  const key = profileStorageKey(walletAddress);
  const saved = localStorage.getItem(key);

  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved) as UserProfile;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function saveProfile(walletAddress: string, profile: UserProfile) {
  localStorage.setItem(
    profileStorageKey(walletAddress),
    JSON.stringify(profile),
  );
}

export function clearProfile(walletAddress: string) {
  localStorage.removeItem(profileStorageKey(walletAddress));
}
PROLLY_P0_EOF
echo "  wrote lib/profile-store.ts"

mkdir -p "lib"
cat > "lib/favorite-store.ts" << 'PROLLY_P0_EOF'
import { normalizeAddress } from "@/lib/wallet-identity";

// Legacy, pre-wallet-identity key. No longer written to. Only read once,
// by migrateLegacyFavorites(), then deleted.
const LEGACY_FAVORITES_KEY = "prolly-favorites";

function favoritesStorageKey(walletAddress: string): string {
  return `prolly-favorites:${normalizeAddress(walletAddress)}`;
}

function migrateLegacyFavorites(walletAddress: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const legacy = localStorage.getItem(LEGACY_FAVORITES_KEY);

  if (!legacy) {
    return;
  }

  const key = favoritesStorageKey(walletAddress);
  const alreadyHasOwnFavorites = localStorage.getItem(key) !== null;

  if (!alreadyHasOwnFavorites) {
    try {
      const parsed = JSON.parse(legacy);

      if (Array.isArray(parsed)) {
        localStorage.setItem(key, legacy);
      }
    } catch {
      // Corrupt legacy data -- nothing worth migrating.
    }
  }

  localStorage.removeItem(LEGACY_FAVORITES_KEY);
}

export function loadFavoriteProllyIds(walletAddress: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  migrateLegacyFavorites(walletAddress);

  const key = favoritesStorageKey(walletAddress);
  const saved = localStorage.getItem(key);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (id): id is string => typeof id === "string",
    );
  } catch {
    return [];
  }
}

export function saveFavoriteProllyIds(walletAddress: string, ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const uniqueIds = Array.from(new Set(ids));

  localStorage.setItem(
    favoritesStorageKey(walletAddress),
    JSON.stringify(uniqueIds),
  );
}

export function isFavoriteProlly(walletAddress: string, id: string): boolean {
  return loadFavoriteProllyIds(walletAddress).includes(id);
}

export function toggleFavoriteProlly(walletAddress: string, id: string): string[] {
  const current = loadFavoriteProllyIds(walletAddress);

  const updated = current.includes(id)
    ? current.filter((favoriteId) => favoriteId !== id)
    : [...current, id];

  saveFavoriteProllyIds(walletAddress, updated);

  return updated;
}
PROLLY_P0_EOF
echo "  wrote lib/favorite-store.ts"

mkdir -p "lib"
cat > "lib/prolly-store.ts" << 'PROLLY_P0_EOF'
import { normalizeAddress } from "@/lib/wallet-identity";

// P0-3: this file previously duplicated its own UserRole type, identical
// to lib/access-control.ts's (dead/unimported) version, and incompatible
// with lib/role-store.ts's richer one (which is the version actually
// used, by app/sponsor/page.tsx). Removed here -- role-store.ts's
// UserRole is now the single canonical definition.

export type SponsorCategory = "task" | "private" | "manual";

export type Participant = {
  id: string;
  // Optional at the type level because Manual-category Prollys (sponsor
  // supplies a fixed list of eligible names/addresses directly) may
  // eventually add participants without a connected wallet. For the
  // self-join flow (app/prollys/page.tsx), this is always set -- that's
  // what duplicate-join protection checks against.
  walletAddress?: string;
  username: string;
  joinedAt: number;
};

export type Prolly = {
  id: string;
  title: string;
  description: string;

  creatorUsername: string;
  creatorRole: "admin" | "sponsor";

  entryAmount: number;
  participants: number;
  participantList?: Participant[];

  maxParticipants: number;
  winners: number;

  closingMode: "participants" | "time" | "either";
  durationMinutes?: number;
  createdAt?: number;
  closesAt?: number;

  image?: string;

  sponsorCategory?: SponsorCategory;

  taskInstructions?: string;
  taskPreference?: string;
  taskReferenceImage?: string;

  accessCode?: string;
  accessToken?: string;

  manualOnly?: boolean;
};

export const STORAGE_KEY = "prolly-items";

export const defaultProllys: Prolly[] = [
  {
    id: "lucky-10",
    title: "Lucky 10",
    description:
      "Join this Prolly for a chance to be randomly selected as one of the winners.",
    creatorUsername: "boma",
    creatorRole: "admin",
    entryAmount: 1,
    participants: 0,
    participantList: [],
    maxParticipants: 100,
    winners: 10,
    closingMode: "participants",
  },
  {
    id: "community-reward",
    title: "Community Reward",
    description:
      "A simple transparent Prolly where winners are selected randomly.",
    creatorUsername: "boma",
    creatorRole: "admin",
    entryAmount: 2,
    participants: 0,
    participantList: [],
    maxParticipants: 50,
    winners: 5,
    closingMode: "participants",
  },
];

/**
 * P0-1 migration: any Prolly without a participantList (i.e. every
 * pre-existing record from before wallet-aware participation existed)
 * gets participantList reset to [] and participants snapped to 0. Per
 * the approved plan, old drifted counts are not authoritative and are
 * not preserved -- the wallet-aware system starts from a clean slate for
 * every existing Prolly. This runs every time Prollys are loaded so it
 * self-heals regardless of when a given record was created.
 */
function migrateParticipants(prolly: Prolly): Prolly {
  if (prolly.participantList) {
    return {
      ...prolly,
      participants: prolly.participantList.length,
    };
  }

  return {
    ...prolly,
    participantList: [],
    participants: 0,
  };
}

export function saveProllys(prollys: Prolly[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prollys));
}

export function loadProllys(): Prolly[] {
  if (typeof window === "undefined") {
    return defaultProllys;
  }

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    saveProllys(defaultProllys);
    return defaultProllys;
  }

  try {
    const parsed = JSON.parse(saved) as Prolly[];

    const migrated = parsed.map((prolly) =>
      migrateParticipants({
        ...prolly,
        creatorUsername: prolly.creatorUsername || "boma",
        creatorRole: prolly.creatorRole || "admin",
      }),
    );

    // Persist the migration immediately so it doesn't have to re-run (and
    // isn't silently re-derivable differently) on every future load.
    saveProllys(migrated);

    return migrated;
  } catch {
    saveProllys(defaultProllys);
    return defaultProllys;
  }
}

export function isProllyExpired(prolly: Prolly): boolean {
  if (
    (prolly.closingMode === "time" ||
      prolly.closingMode === "either") &&
    prolly.closesAt
  ) {
    return Date.now() >= prolly.closesAt;
  }

  return false;
}

export function hasReachedParticipantLimit(prolly: Prolly): boolean {
  return prolly.participants >= prolly.maxParticipants;
}

export function shouldCloseProlly(prolly: Prolly): boolean {
  const participantLimitReached = hasReachedParticipantLimit(prolly);
  const timeExpired = isProllyExpired(prolly);

  if (prolly.closingMode === "participants") {
    return participantLimitReached;
  }

  if (prolly.closingMode === "time") {
    return timeExpired;
  }

  return participantLimitReached || timeExpired;
}

/**
 * P0-1: whether this wallet has already joined this Prolly. This is a
 * client-side/localStorage check only -- a UX safeguard, not the
 * authoritative "1 wallet = 1 opportunity" enforcement. That enforcement
 * ultimately belongs to the GenLayer contract's own join()/joined check
 * (P0-4, not yet wired to the frontend). Clearing localStorage, switching
 * browsers, or switching devices will bypass *this* check -- it will not
 * bypass the contract once P0-4 lands.
 */
export function hasWalletJoined(
  prolly: Prolly,
  walletAddress: string,
): boolean {
  const normalized = normalizeAddress(walletAddress);

  return (prolly.participantList ?? []).some(
    (participant) =>
      participant.walletAddress &&
      normalizeAddress(participant.walletAddress) === normalized,
  );
}

/**
 * P0-1: pure helper that returns a new Prolly with the given wallet
 * appended to participantList (and participants count kept in sync as a
 * derived value). Does not check for duplicates or capacity itself --
 * callers (app/prollys/page.tsx) are expected to check
 * hasWalletJoined()/hasReachedParticipantLimit() first, same as the
 * existing shouldCloseProlly() pattern elsewhere in this file.
 */
export function addParticipant(
  prolly: Prolly,
  walletAddress: string,
  username: string,
): Prolly {
  const participant: Participant = {
    id: `${Date.now()}-${normalizeAddress(walletAddress)}`,
    walletAddress: normalizeAddress(walletAddress),
    username,
    joinedAt: Date.now(),
  };

  const participantList = [...(prolly.participantList ?? []), participant];

  return {
    ...prolly,
    participantList,
    participants: participantList.length,
  };
}
PROLLY_P0_EOF
echo "  wrote lib/prolly-store.ts"

mkdir -p "lib"
cat > "lib/role-store.ts" << 'PROLLY_P0_EOF'
import { normalizeAddress } from "@/lib/wallet-identity";

export type UserRole = "user" | "sponsor_pending" | "sponsor" | "admin";

export type SponsorApplication = {
  walletAddress: string;
  name: string;
  description: string;
  website?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

const ROLE_KEY = "prolly-roles";
const APPLICATION_KEY = "prolly-sponsor-applications";

// P0-3: was a locally-duplicated normalize() identical in spirit to
// access-control.ts's normalizeWallet() -- both now consolidated into
// the single shared lib/wallet-identity.ts helper.
const normalize = normalizeAddress;

export function getRole(
  walletAddress: string | undefined,
  adminAddress: string | undefined,
): UserRole {
  if (!walletAddress) return "user";

  if (
    adminAddress &&
    normalize(walletAddress) === normalize(adminAddress)
  ) {
    return "admin";
  }

  const applications = loadSponsorApplications();
  const application = applications.find(
    (item) => normalize(item.walletAddress) === normalize(walletAddress),
  );

  if (application?.status === "approved") {
    return "sponsor";
  }

  if (application?.status === "pending") {
    return "sponsor_pending";
  }

  return "user";
}

export function loadSponsorApplications(): SponsorApplication[] {
  if (typeof window === "undefined") return [];

  const saved = localStorage.getItem(APPLICATION_KEY);

  if (!saved) return [];

  try {
    return JSON.parse(saved) as SponsorApplication[];
  } catch {
    return [];
  }
}

function saveSponsorApplications(
  applications: SponsorApplication[],
) {
  localStorage.setItem(
    APPLICATION_KEY,
    JSON.stringify(applications),
  );
}

export function getSponsorApplication(
  walletAddress: string,
): SponsorApplication | undefined {
  return loadSponsorApplications().find(
    (item) =>
      normalize(item.walletAddress) === normalize(walletAddress),
  );
}

export function submitSponsorApplication(
  application: SponsorApplication,
) {
  const applications = loadSponsorApplications();

  const existing = applications.findIndex(
    (item) =>
      normalize(item.walletAddress) ===
      normalize(application.walletAddress),
  );

  if (existing >= 0) {
    applications[existing] = application;
  } else {
    applications.push(application);
  }

  saveSponsorApplications(applications);
}

export function updateSponsorApplicationStatus(
  walletAddress: string,
  status: "approved" | "rejected",
) {
  const applications = loadSponsorApplications();

  const updated = applications.map((application) =>
    normalize(application.walletAddress) === normalize(walletAddress)
      ? {
          ...application,
          status,
        }
      : application,
  );

  saveSponsorApplications(updated);
}
PROLLY_P0_EOF
echo "  wrote lib/role-store.ts"

mkdir -p "app/prollys"
cat > "app/prollys/page.tsx" << 'PROLLY_P0_EOF'

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  addParticipant,
  hasReachedParticipantLimit,
  hasWalletJoined,
  loadProllys,
  saveProllys,
  shouldCloseProlly,
  type Prolly,
} from "@/lib/prolly-store";
import { loadProfile, type UserProfile } from "@/lib/profile-store";

export default function ProllysPage() {
    const [prollys, setProllys] = useState<Prolly[]>(() => loadProllys());
  const [selectedProlly, setSelectedProlly] = useState<Prolly | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  const { address, isConnected } = useAccount();

  // Wallet-scoped data (profile) can only be resolved client-side, after
  // the connected wallet is known -- avoids SSR/hydration mismatches,
  // same pattern used elsewhere in this app (e.g. WalletButton).
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (address) {
      setProfile(loadProfile(address));
    } else {
      setProfile(null);
    }
  }, [address]);

  function displayName(): string {
    if (profile?.username) {
      return profile.username;
    }

    if (address) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    return "anonymous";
  }

  // Check for expired/full Prollys periodically
  useEffect(() => {
    const checkClosedProllys = () => {
      setProllys((current) => {
        let changed = false;

        const updated = current.map((prolly) => {
          if (shouldCloseProlly(prolly)) {
            changed = true;
          }

          return prolly;
        });

        if (changed) {
          saveProllys(updated);
        }

        return updated;
      });
    };

    checkClosedProllys();

    const interval = setInterval(checkClosedProllys, 1000);

    return () => clearInterval(interval);
  }, []);

  function joinProlly(prolly: Prolly) {
    // P0-1/P0-2: joining requires a connected wallet -- there is no
    // identity to record participation against otherwise.
    if (!isConnected || !address) {
      alert("Connect your wallet to join a Prolly.");
      return;
    }

    // Check again immediately before joining
    if (shouldCloseProlly(prolly)) {
      alert("This Prolly is closed.");
      setSelectedProlly(null);
      return;
    }

    if (hasReachedParticipantLimit(prolly)) {
      alert("This Prolly is full.");
      setSelectedProlly(null);
      return;
    }

    // P0-1: one wallet, one opportunity per Prolly. This is a
    // client-side/localStorage safeguard for UX only -- it is not the
    // authoritative enforcement of that rule. The GenLayer contract's own
    // join() check is what ultimately has to hold once the frontend is
    // wired to it (P0-4); clearing localStorage or switching browsers
    // bypasses only this check, not that one.
    if (hasWalletJoined(prolly, address)) {
      alert("This wallet has already joined this Prolly.");
      setSelectedProlly(null);
      return;
    }

    const updatedProllys = prollys.map((item) =>
      item.id === prolly.id
        ? addParticipant(item, address, displayName())
        : item,
    );

    setProllys(updatedProllys);
    saveProllys(updatedProllys);

    setSelectedProlly(null);
  }

  const selectedPool = useMemo(() => {
    if (!selectedProlly) return 0;

    return (
      selectedProlly.entryAmount * selectedProlly.participants
    );
  }, [selectedProlly]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* NAVIGATION */}
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link
  href="/"
  className="text-2xl font-bold tracking-tight"
>
  PROLLY<span className="text-violet-400">.</span>
</Link>

          <a
            href="/admin"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          >
            Create a Prolly
          </a>
        </div>
      </nav>

      {/* EXPLORE HEADER */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Explore
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Choose your Prolly.
          </h1>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            Pick an active Prolly and join immediately. Every
            participant gets one opportunity.
          </p>
        </div>

        {/* PROLLY CARDS */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {prollys.map((prolly) => {
            const pool =
              prolly.entryAmount * prolly.participants;

            const isFull = hasReachedParticipantLimit(prolly);

            const isClosed = shouldCloseProlly(prolly);

            const isJoined =
              mounted && !!address && hasWalletJoined(prolly, address);

            return (
              <article
                key={prolly.id}
                className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50"
              >
                <div className="p-6">
                  {/* TITLE */}
                  <h2 className="text-2xl font-bold">
                    {prolly.title || "Untitled Prolly"}
                  </h2>

                  {/* DESCRIPTION */}
                  <p className="mt-3 min-h-14 text-sm leading-6 text-zinc-400">
                    {prolly.description ||
                      "No description provided."}
                  </p>

                  {/* IMAGE PLACEHOLDER */}
                  <div className="mt-6 flex h-48 items-center justify-center rounded-2xl bg-zinc-800">
                    <span className="text-sm text-zinc-600">
                      Prolly image
                    </span>
                  </div>

                  {/* DETAILS */}
                  <div className="mt-6 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Entry fee
                      </span>

                      <span className="font-medium">
                        ${prolly.entryAmount}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Participants
                      </span>

                      <span className="font-medium">
                        {prolly.participants} /{" "}
                        {prolly.maxParticipants}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Prize pool
                      </span>

                      <span className="font-semibold text-violet-400">
                        ${pool}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Winners
                      </span>

                      <span className="font-medium">
                        {prolly.winners}
                      </span>
                    </div>
                  </div>

                  {/* JOIN BUTTON */}
                  <button
                    disabled={
                      isClosed || isFull || isJoined || (mounted && !isConnected)
                    }
                    onClick={() =>
                      setSelectedProlly(prolly)
                    }
                    className={`mt-7 w-full rounded-full py-3 font-semibold ${
                      isClosed || isFull || isJoined || (mounted && !isConnected)
                        ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                        : "bg-violet-500 hover:bg-violet-400"
                    }`}
                  >
                    {isClosed
                      ? "Prolly Closed"
                      : isFull
                        ? "Prolly Full"
                        : isJoined
                          ? "Already Joined"
                          : mounted && !isConnected
                            ? "Connect wallet to join"
                            : "Join Prolly"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {prollys.length === 0 && (
          <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <p className="text-zinc-400">
              No Prollys are available yet.
            </p>

            <a
              href="/admin"
              className="mt-5 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
            >
              Create a Prolly
            </a>
          </div>
        )}
      </section>

      {/* JOIN MODAL */}
      {selectedProlly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              Join Prolly
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              {selectedProlly.title ||
                "Untitled Prolly"}
            </h2>

            <p className="mt-4 text-sm leading-6 text-zinc-400">
              {selectedProlly.description ||
                "No description provided."}
            </p>

            <div className="mt-7 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Entry fee
                </span>

                <span>
                  ${selectedProlly.entryAmount}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Participants
                </span>

                <span>
                  {selectedProlly.participants} /{" "}
                  {selectedProlly.maxParticipants}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Current prize pool
                </span>

                <span className="font-semibold text-violet-400">
                  ${selectedPool}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Winners
                </span>

                <span>{selectedProlly.winners}</span>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Prototype only. No real payment or blockchain
              transaction will occur.
            </p>

            <button
              disabled={!isConnected}
              onClick={() =>
                joinProlly(selectedProlly)
              }
              className="mt-7 w-full rounded-full bg-violet-500 py-3 font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {isConnected ? "Confirm & Join" : "Connect wallet to join"}
            </button>

            <button
              onClick={() =>
                setSelectedProlly(null)
              }
              className="mt-3 w-full rounded-full border border-zinc-800 py-3 font-semibold hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
PROLLY_P0_EOF
echo "  wrote app/prollys/page.tsx"

mkdir -p "app/profile"
cat > "app/profile/page.tsx" << 'PROLLY_P0_EOF'
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  loadProfile,
  saveProfile,
  type UserProfile,
} from "@/lib/profile-store";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  const { address, isConnected } = useAccount();

  // Profile is wallet-scoped (P0-2) -- it can only be loaded once we know
  // which wallet is connected, and switching wallets must show that
  // wallet's own profile, not a stale one from a previous address.
  useEffect(() => {
    if (!address) {
      setProfile(null);
      setUsername("");
      return;
    }

    const saved = loadProfile(address);

    if (saved) {
      setProfile(saved);
      setUsername(saved.username);
    } else {
      setProfile(null);
      setUsername("");
    }
  }, [address]);

  function handleSave() {
    if (!address) {
      setMessage("Connect your wallet before setting a username.");
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, "");

    if (!cleanUsername) {
      setMessage("Please choose a username.");
      return;
    }

    if (cleanUsername.length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    if (cleanUsername.length > 20) {
      setMessage("Username cannot exceed 20 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setMessage(
        "Username can only contain letters, numbers, and underscores.",
      );
      return;
    }

    const now = Date.now();

    const updatedProfile: UserProfile = {
      username: cleanUsername,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    };

    saveProfile(address, updatedProfile);
    setProfile(updatedProfile);
    setUsername(cleanUsername);
    setMessage("Profile saved successfully.");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
  <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
    <Link
      href="/"
      className="text-2xl font-bold tracking-tight"
    >
      PROLLY<span className="text-violet-400">.</span>
    </Link>

        <div className="flex items-center gap-3">
      <Link
        href="/prollys"
        className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
      >
        Explore
      </Link>
    </div>
  </div>
</nav>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Profile
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Your Prolly identity.
        </h1>

        <p className="mt-5 text-lg leading-8 text-zinc-400">
          Choose the username that will appear when you participate
          in a Prolly.
        </p>

        <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
          <label className="text-sm font-medium text-zinc-300">
            Username
          </label>

          <div className="mt-2 flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4">
            <span className="text-zinc-500">@</span>

            <input
              value={username}
              disabled={!isConnected}
              onChange={(e) => {
                setUsername(e.target.value);
                setMessage("");
              }}
              placeholder="username"
              maxLength={20}
              className="w-full bg-transparent px-2 py-3 outline-none disabled:cursor-not-allowed disabled:text-zinc-600"
            />
          </div>

          <p className="mt-3 text-sm text-zinc-500">
            3–20 characters. Letters, numbers, and underscores only.
          </p>

          <button
            disabled={!isConnected}
            onClick={handleSave}
            className="mt-7 w-full rounded-full bg-violet-500 py-3 font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {!isConnected
              ? "Connect wallet to continue"
              : profile
                ? "Update Username"
                : "Create Profile"}
          </button>

          {message && (
            <p className="mt-4 text-center text-sm text-zinc-400">
              {message}
            </p>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
          <p className="font-semibold text-violet-300">
            Prototype profile
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Your username is tied to your connected wallet and stored
            locally in this browser. Connecting a different wallet shows
            that wallet&apos;s own profile.
          </p>
        </div>
      </section>
    </main>
  );
}
PROLLY_P0_EOF
echo "  wrote app/profile/page.tsx"

mkdir -p "app/admin"
cat > "app/admin/page.tsx" << 'PROLLY_P0_EOF'
"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  defaultProllys,
  loadProllys,
  saveProllys,
  type Prolly,
} from "@/lib/prolly-store";
import { loadProfile } from "@/lib/profile-store";

import {
 getRole,
  loadSponsorApplications,
  updateSponsorApplicationStatus,
  type SponsorApplication,
} from "@/lib/role-store";
const ADMIN_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS;

type ProllyStatus = "active" | "closed" | "cancelled";

function getStatus(prolly: Prolly): ProllyStatus {
  if (typeof window === "undefined") {
    return "active";
  }

  const statuses = localStorage.getItem("prolly-statuses");

  if (statuses) {
    try {
      const parsed = JSON.parse(statuses) as Record<string, ProllyStatus>;

      if (parsed[prolly.id]) {
        return parsed[prolly.id];
      }
    } catch {}
  }

  if (prolly.participants >= prolly.maxParticipants) {
    return "closed";
  }

  return "active";
}

function saveStatus(id: string, status: ProllyStatus) {
  const saved = localStorage.getItem("prolly-statuses");

  let statuses: Record<string, ProllyStatus> = {};

  if (saved) {
    try {
      statuses = JSON.parse(saved);
    } catch {}
  }

  statuses[id] = status;
  localStorage.setItem("prolly-statuses", JSON.stringify(statuses));
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();

   const [prollys, setProllys] = useState<Prolly[]>(() => {
    const stored = loadProllys();

    if (stored.length === 0) {
      saveProllys(defaultProllys);
      return defaultProllys;
    }

    return stored;
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [statuses, setStatuses] = useState<Record<string, ProllyStatus>>(
    () => {
      const stored = loadProllys();

      if (stored.length === 0) {
        return Object.fromEntries(
          defaultProllys.map((prolly) => [prolly.id, getStatus(prolly)]),
        );
      }

      return Object.fromEntries(
        stored.map((prolly) => [prolly.id, getStatus(prolly)]),
      );
    },
  );

  const [showCreate, setShowCreate] = useState(false);

  const [sponsorApplications, setSponsorApplications] = useState<
    SponsorApplication[]
  >(() => loadSponsorApplications());

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("1");
  const [maxParticipants, setMaxParticipants] = useState("100");
  const [winners, setWinners] = useState("10");
  const [closingMode, setClosingMode] = useState<
    "participants" | "time" | "either"
  >("participants");
  const [duration, setDuration] = useState("60");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsAdmin(getRole(address, ADMIN_ADDRESS) === "admin");
  }, [address]);

  

const stats = useMemo(() => {
  const active = prollys.filter(
    (p) => (statuses[p.id] || "active") === "active",
  ).length;

  const closed = prollys.filter(
    (p) => (statuses[p.id] || "active") === "closed",
  ).length;

  const totalParticipants = prollys.reduce(
    (sum, p) => sum + p.participants,
    0,
  );

  const totalPool = prollys.reduce(
    (sum, p) => sum + p.entryAmount * p.participants,
    0,
  );

  return {
    total: prollys.length,
    active,
    closed,
    totalParticipants,
    totalPool,
  };
}, [prollys, statuses]);

if (!mounted) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
        <p className="text-zinc-400">Loading...</p>
      </div>
    </main>
  );
}


    if (!isConnected) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <h1 className="text-2xl font-bold">
              Admin access required
            </h1>
            <p className="mt-3 text-zinc-400">
              Connect your admin wallet to continue.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <h1 className="text-2xl font-bold">
              Access denied
            </h1>
            <p className="mt-3 text-zinc-400">
              This wallet does not have administrator privileges.
            </p>
          </div>
        </div>
      </main>
    );
  }

  function handleCreate() {
    const fee = Number(entryFee);
    const max = Number(maxParticipants);
    const winnerCount = Number(winners);

    if (fee <= 0) {
      alert("Entry fee must be greater than zero.");
      return;
    }

    if (max <= 0) {
      alert("Maximum participants must be greater than zero.");
      return;
    }

    if (winnerCount <= 0) {
      alert("Number of winners must be greater than zero.");
      return;
    }

    if (winnerCount > max) {
      alert("Number of winners cannot exceed maximum participants.");
      return;
    }

    // P0-3: creator identity now reflects the actually-connected admin
    // wallet instead of being hardcoded. creatorRole is correctly
    // "admin" here specifically because this function is only reachable
    // past the isAdmin gate above -- not re-hardcoded for its own sake.
    if (!address) {
      alert("Connect your wallet to create a Prolly.");
      return;
    }

    const adminProfile = loadProfile(address);
    const creatorUsername =
      adminProfile?.username ?? `${address.slice(0, 6)}...${address.slice(-4)}`;

    const newProlly: Prolly = {
  id: `${Date.now()}-${name.toLowerCase().replace(/\s+/g, "-") || "prolly"}`,
  title: name.trim(),
  description: description.trim(),

  creatorUsername,
creatorRole: "admin",

  entryAmount: fee,
      participants: 0,
      maxParticipants: max,
      winners: winnerCount,
      closingMode,
      durationMinutes:
        closingMode === "participants" ? undefined : Number(duration) || 60,
      createdAt: Date.now(),
      closesAt:

        closingMode === "participants"
          ? undefined
          : Date.now() + (Number(duration) || 60) * 60 * 1000,
    };

    const updated = [...prollys, newProlly];

    saveProllys(updated);
    saveStatus(newProlly.id, "active");

    setProllys(updated);
    setStatuses((current) => ({
      ...current,
      [newProlly.id]: "active",
    }));

    setName("");
    setDescription("");
    setEntryFee("1");
    setMaxParticipants("100");
    setWinners("10");
    setClosingMode("participants");
    setDuration("60");
    setShowCreate(false);
  }

  function closeProlly(prolly: Prolly) {
    if (!confirm(`Close "${prolly.title || "Untitled Prolly"}"?`)) {
      return;
    }

    saveStatus(prolly.id, "closed");

    setStatuses((current) => ({
      ...current,
      [prolly.id]: "closed",
    }));
  }
function approveSponsor(application: SponsorApplication) {
  updateSponsorApplicationStatus(
    application.walletAddress,
    "approved",
  );

  setSponsorApplications((current) =>
    current.map((item) =>
      item.walletAddress.toLowerCase() ===
      application.walletAddress.toLowerCase()
        ? { ...item, status: "approved" }
        : item,
    ),
  );
}

function rejectSponsor(application: SponsorApplication) {
  updateSponsorApplicationStatus(
    application.walletAddress,
    "rejected",
  );

  setSponsorApplications((current) =>
    current.map((item) =>
      item.walletAddress.toLowerCase() ===
      application.walletAddress.toLowerCase()
        ? { ...item, status: "rejected" }
        : item,
    ),
  );
}
    
function handleSponsorDecision(
  walletAddress: string,
  status: "approved" | "rejected",
) {
  updateSponsorApplicationStatus(walletAddress, status);
  setSponsorApplications(loadSponsorApplications());
}

function deleteProlly(prolly: Prolly) {
  if (
    !confirm(
      `Delete "${prolly.title || "Untitled Prolly"}"? This cannot be undone.`,
    )
  ) {
    return;
  }

  const updated = prollys.filter((item) => item.id !== prolly.id);

  saveProllys(updated);
  localStorage.removeItem(`prolly-participants-${prolly.id}`);

  setProllys(updated);

  setStatuses((current) => {
    const copy = { ...current };
    delete copy[prolly.id];
    return copy;
  });

  const savedStatuses = localStorage.getItem("prolly-statuses");

  if (savedStatuses) {
    try {
      const parsed = JSON.parse(savedStatuses);
      delete parsed[prolly.id];
      localStorage.setItem("prolly-statuses", JSON.stringify(parsed));
    } catch {}
  }
}
      
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
  <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
    <Link href="/" className="text-2xl font-bold tracking-tight">
      PROLLY<span className="text-violet-400">.</span>
    </Link>

    <div className="flex items-center gap-3">
            <Link
  href="/prollys"
  className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
>
  Explore
</Link>

            <button
              onClick={() => setShowCreate(true)}
              className="rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold hover:bg-violet-400"
            >
              + Create Prolly
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Admin Dashboard
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Manage your Prollys.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
            Create, monitor, and manage your Prollys from one place.
          </p>
        </div>

        {/* STATS */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Total Prollys</p>
            <p className="mt-2 text-3xl font-bold">{stats.total}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Active</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {stats.active}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Closed</p>
            <p className="mt-2 text-3xl font-bold">{stats.closed}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Participants</p>
            <p className="mt-2 text-3xl font-bold">
              {stats.totalParticipants}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Total Pool</p>
            <p className="mt-2 text-3xl font-bold text-violet-400">
              ${stats.totalPool}
            </p>
          </div>
        </div>
     
 {/* SPONSOR APPLICATIONS */}
<div className="mt-12 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40">
  <div className="border-b border-zinc-800 px-6 py-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold">
          Sponsor Applications
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Approve users who qualify to become Prolly sponsors.
        </p>
      </div>

      <span className="rounded-full bg-violet-500/10 px-3 py-1 text-sm font-semibold text-violet-400">
        {
          sponsorApplications.filter(
            (application) => application.status === "pending",
          ).length
        }{" "}
        pending
      </span>
    </div>
  </div>

  {sponsorApplications.length === 0 ? (
    <div className="px-6 py-12 text-center">
      <p className="text-zinc-500">
        No sponsor applications yet.
      </p>
    </div>
  ) : (
    <div className="divide-y divide-zinc-800">
      {sponsorApplications.map((application) => (
        <div
          key={application.walletAddress}
          className="p-6"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-bold">
                  {application.name}
                </h3>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    application.status === "pending"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : application.status === "approved"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {application.status}
                </span>
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                {application.description}
              </p>

              {application.website && (
                <p className="mt-2 text-sm text-violet-400">
                  {application.website}
                </p>
              )}

              <p className="mt-3 break-all text-xs text-zinc-600">
                Wallet: {application.walletAddress}
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Applied:{" "}
                {new Date(
                  application.createdAt,
                ).toLocaleString()}
              </p>
            </div>

            {application.status === "pending" && (
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() =>
                    handleSponsorDecision(
                      application.walletAddress,
                      "approved",
                    )
                  }
                  className="rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-black hover:bg-green-400"
                >
                  Approve Sponsor
                </button>

                <button
                  onClick={() =>
                    handleSponsorDecision(
                      application.walletAddress,
                      "rejected",
                    )
                  }
                  className="rounded-full border border-red-500/30 px-5 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )}
</div>


       {/* PROLLY TABLE */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-6 py-5">
            <h2 className="text-xl font-bold">Your Prollys</h2>
          </div>

          {prollys.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-zinc-400">You have not created any Prollys.</p>

              <button
                onClick={() => setShowCreate(true)}
                className="mt-5 rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
              >
                Create your first Prolly
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {prollys.map((prolly) => {
                const status = statuses[prolly.id] || "active";
                const pool = prolly.entryAmount * prolly.participants;
                const progress =
                  (prolly.participants / prolly.maxParticipants) * 100;

                return (
                  <div
                    key={prolly.id}
                    className="p-6 transition hover:bg-zinc-900/70"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold">
                            {prolly.title || "Untitled Prolly"}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              status === "active"
                                ? "bg-green-500/10 text-green-400"
                                : status === "closed"
                                  ? "bg-zinc-800 text-zinc-400"
                                  : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                          {prolly.description || "No description provided."}
                        </p>

                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{
                              width: `${Math.min(progress, 100)}%`,
                            }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
                          <span>
                            Participants:{" "}
                            <strong className="text-zinc-300">
                              {prolly.participants}/{prolly.maxParticipants}
                            </strong>
                          </span>

                          <span>
                            Entry:{" "}
                            <strong className="text-zinc-300">
                              ${prolly.entryAmount}
                            </strong>
                          </span>

                          <span>
                            Pool:{" "}
                            <strong className="text-violet-400">
                              ${pool}
                            </strong>
                          </span>

                          <span>
                            Winners:{" "}
                            <strong className="text-zinc-300">
                              {prolly.winners}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
  href="/prollys"
  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-800"
>
  View
</Link>

                        {status === "active" && (
                          <button
                            onClick={() => closeProlly(prolly)}
                            className="rounded-full border border-yellow-500/30 px-4 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-500/10"
                          >
                            Close
                          </button>
                        )}

                        <button
                          onClick={() => deleteProlly(prolly)}
                          className="rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
          <p className="font-semibold text-violet-300">Prototype notice</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Admin data is currently stored in this browser only. Closing,
            reopening, and deleting Prollys are prototype actions. No real
            blockchain transaction or payment occurs yet.
          </p>
        </div>
      </section>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-6">
          <div className="mx-auto my-10 w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
                  New Prolly
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  Create a Prolly
                </h2>
              </div>

              <button
                onClick={() => setShowCreate(false)}
                className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-400 hover:bg-zinc-900"
              >
                ✕
              </button>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <label className="text-sm font-medium text-zinc-300">
                  Title <span className="text-zinc-600">(optional)</span>
                </label>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Friday Jackpot"
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300">
                  Description{" "}
                  <span className="text-zinc-600">(optional)</span>
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell participants what this Prolly is about..."
                  rows={4}
                  className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Entry fee
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Maximum participants
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Number of winners
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={winners}
                    onChange={(e) => setWinners(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Closing condition
                  </label>

                  <select
                    value={closingMode}
                    onChange={(e) =>
                      setClosingMode(
                        e.target.value as
                          | "participants"
                          | "time"
                          | "either",
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  >
                    <option value="participants">
                      Maximum participants
                    </option>
                    <option value="time">Time limit</option>
                    <option value="either">Either condition</option>
                  </select>
                </div>
              </div>

              {(closingMode === "time" || closingMode === "either") && (
                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Duration (minutes)
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>
              )}

              <button
                onClick={handleCreate}
                className="w-full rounded-full bg-violet-500 py-4 font-semibold hover:bg-violet-400"
              >
                Create Prolly
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
PROLLY_P0_EOF
echo "  wrote app/admin/page.tsx"

mkdir -p "."
cat > "P0_IMPLEMENTATION_PLAN.md" << 'PROLLY_P0_EOF'
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
PROLLY_P0_EOF
echo "  wrote P0_IMPLEMENTATION_PLAN.md"

mkdir -p "."
cat > "ROADMAP_STATUS.md" << 'PROLLY_P0_EOF'
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
PROLLY_P0_EOF
echo "  wrote ROADMAP_STATUS.md"

echo "Done. Now run: git status && git diff --stat"
