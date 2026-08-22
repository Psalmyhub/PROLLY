export type UserRole = "user" | "sponsor" | "admin";

export type SponsorApplicationStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

/*
 * PROTOTYPE ADMIN CONFIGURATION
 *
 * This is temporary.
 * The final version will use the connected wallet address
 * and on-chain authorization through GenLayer.
 *
 * Replace this address with the wallet address that will
 * be your real Prolly admin wallet.
 */
export const ADMIN_WALLETS = [
  "REPLACE_WITH_ADMIN_WALLET",
];

export function normalizeWallet(address: string): string {
  return address.trim().toLowerCase();
}

export function isAdmin(walletAddress: string | null): boolean {
  if (!walletAddress) {
    return false;
  }

  const normalized = normalizeWallet(walletAddress);

  return ADMIN_WALLETS.some(
    (adminWallet) =>
      normalizeWallet(adminWallet) === normalized,
  );
}

export function canAccessAdmin(
  walletAddress: string | null,
): boolean {
  return isAdmin(walletAddress);
}

export function canCreateAdminProlly(
  walletAddress: string | null,
): boolean {
  return isAdmin(walletAddress);
}

export function canCreateSponsorProlly(
  walletAddress: string | null,
  sponsorStatus: SponsorApplicationStatus,
): boolean {
  return (
    isAdmin(walletAddress) ||
    sponsorStatus === "approved"
  );
}

export function canApproveSponsorApplications(
  walletAddress: string | null,
): boolean {
  return isAdmin(walletAddress);
}
