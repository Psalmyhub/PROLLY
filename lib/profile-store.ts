import { normalizeAddress } from "@/lib/wallet-identity";

export type UserProfile = {
  username: string;
  bio: string;
  website: string;
  telegram: string;
  discord: string;
  twitter: string;
  createdAt: number;
  updatedAt: number;
};

const LEGACY_PROFILE_STORAGE_KEY = "prolly-user-profile";

function profileStorageKey(walletAddress: string) {
  return `prolly-user-profile:${normalizeAddress(walletAddress)}`;
}

function migrateLegacyProfile(walletAddress: string) {
  if (typeof window === "undefined") return;
  const legacy=localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
  if(!legacy)return;
  const key=profileStorageKey(walletAddress);
  if(!localStorage.getItem(key)){
    try{
      const old=JSON.parse(legacy);
      localStorage.setItem(key,JSON.stringify({
        username:old.username??"",bio:"",website:"",telegram:"",discord:"",twitter:"",
        createdAt:Number(old.createdAt??Date.now()),updatedAt:Number(old.updatedAt??Date.now())
      }));
    }catch{}
  }
  localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
}

export function loadProfile(walletAddress:string):UserProfile|null{
  if(typeof window==="undefined")return null;
  migrateLegacyProfile(walletAddress);
  const saved=localStorage.getItem(profileStorageKey(walletAddress));
  if(!saved)return null;
  try{
    const p=JSON.parse(saved);
    return {username:p.username??"",bio:p.bio??"",website:p.website??"",telegram:p.telegram??"",discord:p.discord??"",twitter:p.twitter??"",createdAt:Number(p.createdAt??Date.now()),updatedAt:Number(p.updatedAt??Date.now())};
  }catch{localStorage.removeItem(profileStorageKey(walletAddress));return null;}
}

export function saveProfile(walletAddress: string, profile: UserProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(profileStorageKey(walletAddress), JSON.stringify(profile));
}

export function getProfileDisplayName(walletAddress: string): string {
  const profile = loadProfile(walletAddress);
  return profile?.username?.trim() || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
}
