import { normalizeAddress } from "@/lib/wallet-identity";

export type SponsorCampaignType = "manual" | "task" | "generated-link";

export type SponsorCampaign = {
  id: string;
  ownerWallet: string;
  title: string;
  type: SponsorCampaignType;
  description: string;
  instructions: string;
  reference: string;
  createdAt: number;
  accessCode?: string;
  entryFee?: string;
  maxParticipants?: string;
  winnerCount?: string;
};

const STORAGE_KEY = "prolly-sponsor-campaigns";

export function loadAllSponsorCampaigns(): SponsorCampaign[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as SponsorCampaign[]) : [];
  } catch {
    return [];
  }
}

export function loadSponsorCampaigns(
  walletAddress?: string,
): SponsorCampaign[] {
  const campaigns = loadAllSponsorCampaigns();

  if (!walletAddress) return campaigns;

  const wallet = normalizeAddress(walletAddress);
  return campaigns.filter(
    (campaign) => normalizeAddress(campaign.ownerWallet) === wallet,
  );
}

export function saveSponsorCampaigns(
  walletAddress: string,
  campaigns: SponsorCampaign[],
) {
  const existing = loadAllSponsorCampaigns();
  const wallet = normalizeAddress(walletAddress);

  const others = existing.filter(
    (campaign) => normalizeAddress(campaign.ownerWallet) !== wallet,
  );

  const owned = campaigns.map((campaign) => ({
    ...campaign,
    ownerWallet: walletAddress,
  }));

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([...owned, ...others]),
  );
}

export function removeSponsorCampaign(
  walletAddress: string,
  campaignId: string,
) {
  const remaining = loadAllSponsorCampaigns().filter(
    (campaign) =>
      !(
        campaign.id === campaignId &&
        normalizeAddress(campaign.ownerWallet) ===
          normalizeAddress(walletAddress)
      ),
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}
