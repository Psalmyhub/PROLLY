const FAVORITES_KEY = "prolly-favorites";

export function loadFavoriteProllyIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const saved = localStorage.getItem(FAVORITES_KEY);

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

export function saveFavoriteProllyIds(ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const uniqueIds = Array.from(new Set(ids));

  localStorage.setItem(
    FAVORITES_KEY,
    JSON.stringify(uniqueIds),
  );
}

export function isFavoriteProlly(id: string): boolean {
  return loadFavoriteProllyIds().includes(id);
}

export function toggleFavoriteProlly(id: string): string[] {
  const current = loadFavoriteProllyIds();

  const updated = current.includes(id)
    ? current.filter((favoriteId) => favoriteId !== id)
    : [...current, id];

  saveFavoriteProllyIds(updated);

  return updated;
}
