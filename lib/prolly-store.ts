import { normalizeAddress } from "@/lib/wallet-identity";

export type SponsorCategory = "link" | "manual";
export type Participant = { id: string; walletAddress?: string; username: string; joinedAt: number };

export type Prolly = {
  onChainId?: string;
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
  sponsorStartAt?: number;
  sponsorAccessOpensAt?: number;
  sponsorAccessToken?: string;
  sponsorCommunityLinks?: Array<{ label: string; url: string }>;
};

export const STORAGE_KEY = "prolly-items";
export const defaultProllys: Prolly[] = [];

function migrateSponsorCategory(value: unknown): SponsorCategory | undefined {
  if (value === "manual") return "manual";
  if (value === "task" || value === "generated-link" || value === "private") return "link";
  return undefined;
}

function migrateParticipants(prolly: Prolly): Prolly {
  const participantList = prolly.participantList ?? [];
  return { ...prolly, participantList, participants: participantList.length };
}

export function saveProllys(prollys: Prolly[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(prollys)); }

export function loadProllys(): Prolly[] {
  if (typeof window === "undefined") return defaultProllys;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultProllys;
  try {
    const migrated = (JSON.parse(saved) as Prolly[]).map((item) => migrateParticipants({
      ...item,
      creatorUsername: item.creatorUsername || "admin",
      creatorRole: item.creatorRole || "admin",
      sponsorCategory: migrateSponsorCategory(item.sponsorCategory),
    }));
    saveProllys(migrated);
    return migrated;
  } catch { return defaultProllys; }
}

export function isProllyExpired(prolly: Prolly): boolean { return !!prolly.closesAt && Date.now() >= prolly.closesAt; }
export function hasReachedParticipantLimit(prolly: Prolly): boolean { return prolly.participants >= prolly.maxParticipants; }
export function shouldCloseProlly(prolly: Prolly): boolean { return hasReachedParticipantLimit(prolly) || isProllyExpired(prolly); }

export function hasWalletJoined(prolly: Prolly, walletAddress: string): boolean {
  const normalized = normalizeAddress(walletAddress);
  return (prolly.participantList ?? []).some((p) => !!p.walletAddress && normalizeAddress(p.walletAddress) === normalized);
}

export function addParticipant(prolly: Prolly, walletAddress: string, username: string): Prolly {
  const participant: Participant = {
    id: `${Date.now()}-${normalizeAddress(walletAddress)}`,
    walletAddress: normalizeAddress(walletAddress),
    username,
    joinedAt: Date.now(),
  };
  const participantList = [...(prolly.participantList ?? []), participant];
  return { ...prolly, participantList, participants: participantList.length };
}
