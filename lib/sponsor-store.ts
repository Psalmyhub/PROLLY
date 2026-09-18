import { normalizeAddress } from "@/lib/wallet-identity";

export type SponsorCampaignType = "manual" | "link";
export type SponsorParticipant = { username?: string; walletAddress: string };
export type SponsorCommunityLink = { label: string; url: string };

export type SponsorCampaign = {
  id: string;
  ownerWallet: string;
  topic: string;
  description: string;
  type: SponsorCampaignType;
  winnerCount: number;
  maxParticipants: number;
  participantsJoined: number;
  selectedParticipants: SponsorParticipant[];
  startAt?: number;
  accessOpensAt?: number;
  accessToken?: string;
  communityLinks: SponsorCommunityLink[];
  createdAt: number;
  status: "draft" | "published";
};

const STORAGE_KEY = "prolly-sponsor-campaigns";

function migrate(item: Record<string, unknown>): SponsorCampaign {
  return {
    id: item.id ?? `sponsor-${Date.now()}`,
    ownerWallet: item.ownerWallet ?? "",
    topic: item.topic ?? item.title ?? "",
    description: item.description ?? "",
    type: item.type === "manual" ? "manual" : "link",
    winnerCount: Number(item.winnerCount ?? 1),
    maxParticipants: Number(item.maxParticipants ?? 1),
    participantsJoined: Number(item.participantsJoined ?? 0),
    selectedParticipants: Array.isArray(item.selectedParticipants) ? item.selectedParticipants : [],
    startAt: typeof item.startAt === "number" ? item.startAt : undefined,
    accessOpensAt: typeof item.accessOpensAt === "number" ? item.accessOpensAt : undefined,
    accessToken: item.accessToken,
    communityLinks: Array.isArray(item.communityLinks) ? item.communityLinks : [],
    createdAt: Number(item.createdAt ?? Date.now()),
    status: item.status === "published" ? "published" : "draft",
  };
}

export function loadAllSponsorCampaigns(): SponsorCampaign[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Record<string, unknown>[]).map(migrate) : [];
  } catch { return []; }
}

export function loadSponsorCampaigns(walletAddress?: string): SponsorCampaign[] {
  const campaigns = loadAllSponsorCampaigns();
  if (!walletAddress) return campaigns;
  const wallet = normalizeAddress(walletAddress);
  return campaigns.filter((campaign) => normalizeAddress(campaign.ownerWallet) === wallet);
}

export function saveSponsorCampaigns(walletAddress: string, campaigns: SponsorCampaign[]) {
  const existing = loadAllSponsorCampaigns();
  const wallet = normalizeAddress(walletAddress);
  const others = existing.filter((campaign) => normalizeAddress(campaign.ownerWallet) !== wallet);
  const owned = campaigns.map((campaign) => ({ ...campaign, ownerWallet: walletAddress }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...owned, ...others]));
}

export function removeSponsorCampaign(walletAddress: string, campaignId: string) {
  const remaining = loadAllSponsorCampaigns().filter(
    (campaign) => !(campaign.id === campaignId && normalizeAddress(campaign.ownerWallet) === normalizeAddress(walletAddress)),
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}
