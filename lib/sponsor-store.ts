import { normalizeAddress } from "@/lib/wallet-identity";

export type SponsorCampaignType = "manual" | "link";

export type SponsorParticipant = {
  username?: string;
  walletAddress: string;
};

export type SponsorRewardType =
  | "xp"
  | "crypto"
  | "fun"
  | "other";

export type SponsorCommunityLink = {
  label: string;
  url: string;
};

export type SponsorCampaign = {
  id: string;
  ownerWallet: string;
  topic: string;
  description: string;
  type: SponsorCampaignType;
  winnerCount: number;
  maxParticipants: number;
  rewardType: SponsorRewardType;
  rewardAmount?: string;
  rewardCurrency?: string;
  rewardLabel?: string;
  participantsJoined: number;
  selectedParticipants: SponsorParticipant[];
  startAt?: number;
  accessOpensAt?: number;
  accessToken?: string;

  /**
   * Authoritative GenLayer Prolly ID.
   * Sponsor metadata remains local, but the actual participant
   * and winner state lives on GenLayer.
   */
  onChainId?: string;

  /**
   * GenLayer transaction hash returned when the Sponsor Prolly
   * is published.
   */
  publishTxHash?: string;

  expiresAt?: number;
  communityLinks: SponsorCommunityLink[];
  createdAt: number;
  status: "draft" | "published";
};

const STORAGE_KEY = "prolly-sponsor-campaigns";

function stringValue(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string" ? value : fallback;
}

function migrate(
  item: Record<string, unknown>,
): SponsorCampaign {
  return {
    id: stringValue(
      item.id,
      `sponsor-${Date.now()}`,
    ),

    ownerWallet: stringValue(
      item.ownerWallet,
    ),

    topic: stringValue(
      item.topic,
      stringValue(item.title),
    ),

    description: stringValue(
      item.description,
    ),

    type:
      item.type === "manual"
        ? "manual"
        : "link",

    winnerCount: Number(
      item.winnerCount ?? 1,
    ),

    maxParticipants: Number(
      item.maxParticipants ?? 1,
    ),

    rewardType:
      item.rewardType === "crypto" ||
      item.rewardType === "fun" ||
      item.rewardType === "other"
        ? item.rewardType
        : "xp",

    rewardAmount:
      typeof item.rewardAmount === "string"
        ? item.rewardAmount
        : undefined,

    rewardCurrency:
      typeof item.rewardCurrency === "string"
        ? item.rewardCurrency
        : undefined,

    rewardLabel:
      typeof item.rewardLabel === "string"
        ? item.rewardLabel
        : undefined,

    participantsJoined: Number(
      item.participantsJoined ?? 0,
    ),

    selectedParticipants:
      Array.isArray(
        item.selectedParticipants,
      )
        ? (item.selectedParticipants as SponsorParticipant[])
        : [],

    startAt:
      typeof item.startAt === "number"
        ? item.startAt
        : undefined,

    accessOpensAt:
      typeof item.accessOpensAt === "number"
        ? item.accessOpensAt
        : undefined,

    accessToken:
      typeof item.accessToken === "string"
        ? item.accessToken
        : undefined,

    onChainId:
      typeof item.onChainId === "string"
        ? item.onChainId
        : undefined,

    publishTxHash:
      typeof item.publishTxHash === "string"
        ? item.publishTxHash
        : undefined,

    expiresAt:
      typeof item.expiresAt === "number"
        ? item.expiresAt
        : undefined,

    communityLinks:
      Array.isArray(item.communityLinks)
        ? (item.communityLinks as SponsorCommunityLink[])
        : [],

    createdAt: Number(
      item.createdAt ?? Date.now(),
    ),

    status:
      item.status === "published"
        ? "published"
        : "draft",
  };
}

export function loadAllSponsorCampaigns(): SponsorCampaign[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved =
      localStorage.getItem(STORAGE_KEY);

    return saved
      ? (
          JSON.parse(saved) as Record<
            string,
            unknown
          >[]
        ).map(migrate)
      : [];
  } catch {
    return [];
  }
}

export function loadSponsorCampaigns(
  walletAddress?: string,
): SponsorCampaign[] {
  const campaigns =
    loadAllSponsorCampaigns();

  if (!walletAddress) {
    return campaigns;
  }

  const wallet =
    normalizeAddress(walletAddress);

  return campaigns.filter(
    (campaign) =>
      normalizeAddress(
        campaign.ownerWallet,
      ) === wallet,
  );
}

export function saveSponsorCampaigns(
  walletAddress: string,
  campaigns: SponsorCampaign[],
) {
  const existing =
    loadAllSponsorCampaigns();

  const wallet =
    normalizeAddress(walletAddress);

  const others = existing.filter(
    (campaign) =>
      normalizeAddress(
        campaign.ownerWallet,
      ) !== wallet,
  );

  const owned = campaigns.map(
    (campaign) => ({
      ...campaign,
      ownerWallet: walletAddress,
    }),
  );

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      ...owned,
      ...others,
    ]),
  );
}

export function removeSponsorCampaign(
  walletAddress: string,
  campaignId: string,
) {
  const remaining =
    loadAllSponsorCampaigns().filter(
      (campaign) =>
        !(
          campaign.id === campaignId &&
          normalizeAddress(
            campaign.ownerWallet,
          ) ===
            normalizeAddress(
              walletAddress,
            )
        ),
    );

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(remaining),
  );
}
