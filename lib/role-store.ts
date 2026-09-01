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
