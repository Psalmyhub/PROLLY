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
