export type UserRole = "user" | "sponsor" | "admin";

export type SponsorCategory = "task" | "private" | "manual";

export type Participant = {
  id: string;
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
    participants: 24,
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
    participants: 12,
    maxParticipants: 50,
    winners: 5,
    closingMode: "participants",
  },
];

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

    return parsed.map((prolly) => ({
      ...prolly,
      creatorUsername: prolly.creatorUsername || "boma",
      creatorRole: prolly.creatorRole || "admin",
    }));
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
