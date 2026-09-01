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
