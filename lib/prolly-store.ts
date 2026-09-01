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
