export type UserProfile = {
  username: string;
  createdAt: number;
  updatedAt: number;
};

export const PROFILE_STORAGE_KEY = "prolly-user-profile";

export function loadProfile(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = localStorage.getItem(PROFILE_STORAGE_KEY);

  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved) as UserProfile;
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    return null;
  }
}

export function saveProfile(profile: UserProfile) {
  localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify(profile),
  );
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}
