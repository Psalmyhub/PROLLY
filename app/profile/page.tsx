"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import {
  getAllOnChainProllys,
  getParticipants,
  getWinners,
  type OnChainProlly,
} from "@/lib/genlayer";
import { loadProllys, type Prolly } from "@/lib/prolly-store";
import { loadProfile, saveProfile, type UserProfile } from "@/lib/profile-store";
import { getRole, type UserRole } from "@/lib/role-store";
import { PROLLY_CONTRACT_OWNER } from "@/lib/genlayer";
import { normalizeAddress } from "@/lib/wallet-identity";

const FAVORITES_KEY = "prolly-favorites";

type ParticipationStatus = "won" | "lost" | "pending";

type Participation = {
  chain: OnChainProlly;
  local: Prolly;
  status: ParticipationStatus;
  favorite: boolean;
};

function formatGen(value: bigint): string {
  const whole = value / 1000000000000000000n;
  const fraction = value % 1000000000000000000n;

  if (fraction === 0n) return whole.toString();

  return `${whole}.${fraction
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "")}`;
}

function getLocalMetadata(
  onChain: OnChainProlly,
  localProllys: Prolly[],
): Prolly {
  const existing = localProllys.find(
    (item) => item.onChainId === onChain.id.toString(),
  );

  if (existing) {
    return {
      ...existing,
      title: existing.title || onChain.name,
      entryAmount: Number(onChain.entryFee) / 1e18,
      maxParticipants: Number(onChain.maxParticipants),
      winners: Number(onChain.winnerCount),
      participants: Number(onChain.participantCount),
    };
  }

  return {
    id: `onchain-${onChain.id}`,
    onChainId: onChain.id.toString(),
    title: onChain.name,
    description: "",
    creatorUsername: "Admin",
    creatorRole: "admin",
    entryAmount: Number(onChain.entryFee) / 1e18,
    participants: Number(onChain.participantCount),
    maxParticipants: Number(onChain.maxParticipants),
    winners: Number(onChain.winnerCount),
    closingMode: "participants",
  };
}

function statusLabel(status: ParticipationStatus): string {
  if (status === "won") return "Won";
  if (status === "lost") return "Lost";
  return "Pending";
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>("user");
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) {
      setProfile(null);
      setUsername("");
      setRole("user");
      setParticipations([]);
      setLoading(false);
      return;
    }

    const loadedProfile = loadProfile(address);
    setProfile(loadedProfile);
    setUsername(loadedProfile?.username ?? "");
    setRole(getRole(address, PROLLY_CONTRACT_OWNER));

    try {
      const savedFavorites = localStorage.getItem(FAVORITES_KEY);
      setFavoriteIds(
        savedFavorites ? (JSON.parse(savedFavorites) as string[]) : [],
      );
    } catch {
      setFavoriteIds([]);
    }
  }, [address]);

  useEffect(() => {
    let cancelled = false;

    async function loadParticipation() {
      if (!address) {
        setParticipations([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [onChainProllys, localProllys] = await Promise.all([
          getAllOnChainProllys(),
          Promise.resolve(loadProllys()),
        ]);

        const wallet = normalizeAddress(address);

        const results = await Promise.all(
          onChainProllys.map(async (chain) => {
            const participants = await getParticipants(chain.id);

            const joined = participants.some(
              (participant) =>
                normalizeAddress(participant) === wallet,
            );

            if (!joined) return null;

            const winners = chain.winnersFinalized
              ? await getWinners(chain.id)
              : [];

            const isWinner = winners.some(
              (winner) => normalizeAddress(winner) === wallet,
            );

            const local = getLocalMetadata(chain, localProllys);
            const id = chain.id.toString();

            return {
              chain,
              local,
              status: chain.winnersFinalized
                ? isWinner
                  ? "won"
                  : "lost"
                : "pending",
              favorite: favoriteIds.includes(id),
            } satisfies Participation;
          }),
        );

        if (!cancelled) {
          setParticipations(
            results
              .filter((item): item is Participation => item !== null)
              .sort(
                (a, b) => Number(b.chain.id) - Number(a.chain.id),
              ),
          );
        }
      } catch (loadError) {
        console.error("Failed to load profile activity:", loadError);
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load your Prolly activity.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadParticipation();

    return () => {
      cancelled = true;
    };
  }, [address, favoriteIds]);

  function handleSave() {
    if (!address) {
      setMessage("Connect your wallet before setting a username.");
      return;
    }

    const cleanUsername = username.trim().replace(/^@/, "");

    if (!cleanUsername) {
      setMessage("Please choose a username.");
      return;
    }

    if (cleanUsername.length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    if (cleanUsername.length > 20) {
      setMessage("Username cannot exceed 20 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setMessage(
        "Username can only contain letters, numbers, and underscores.",
      );
      return;
    }

    const now = Date.now();

    const updatedProfile: UserProfile = {
      username: cleanUsername,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    };

    saveProfile(address, updatedProfile);
    setProfile(updatedProfile);
    setUsername(cleanUsername);
    setMessage("Profile saved successfully.");
  }

  const joinedCount = participations.length;
  const wins = useMemo(
    () => participations.filter((item) => item.status === "won").length,
    [participations],
  );
  const losses = useMemo(
    () => participations.filter((item) => item.status === "lost").length,
    [participations],
  );
  const pending = useMemo(
    () => participations.filter((item) => item.status === "pending").length,
    [participations],
  );
  const winRate = joinedCount > 0 ? Math.round((wins / joinedCount) * 100) : 0;
  const winLossRatio = losses > 0 ? (wins / losses).toFixed(2) : wins > 0 ? "∞" : "—";

  const displayWallet = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not connected";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            PROLLY<span className="text-violet-400">.</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/prollys"
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
            >
              Explore
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Prolly Identity
          </p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Your Prolly profile.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
            Your wallet is the identity that counts on-chain. Your username
            makes that identity easier for people to recognize.
          </p>
        </div>

        {!isConnected ? (
          <div className="mt-10 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-8">
            <p className="font-semibold text-amber-300">
              Connect your wallet to view your Prolly identity.
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Participation, wins, and losses are read from GenLayer and are
              tied to the connected wallet.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Username</p>
                    <p className="mt-2 text-3xl font-bold">
                      @{profile?.username || "unnamed"}
                    </p>
                    <p className="mt-3 text-sm text-zinc-500">
                      {displayWallet}
                    </p>
                  </div>

                  <span className="w-fit rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-violet-300">
                    {role.replace("_", " ")}
                  </span>
                </div>

                <div className="mt-8">
                  <label className="text-sm font-medium text-zinc-300">
                    Prolly username
                  </label>

                  <div className="mt-2 flex items-center rounded-xl border border-zinc-700 bg-zinc-950 px-4">
                    <span className="text-zinc-500">@</span>
                    <input
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setMessage("");
                      }}
                      placeholder="username"
                      maxLength={20}
                      className="w-full bg-transparent px-2 py-3 outline-none"
                    />
                  </div>

                  <p className="mt-3 text-sm text-zinc-500">
                    3–20 characters. Letters, numbers, and underscores only.
                  </p>

                  <button
                    onClick={handleSave}
                    className="mt-6 rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
                  >
                    {profile ? "Update Username" : "Create Profile"}
                  </button>

                  {message && (
                    <p className="mt-4 text-sm text-zinc-400">{message}</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-violet-500/20 bg-violet-500/5 p-8">
                <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
                  Identity
                </p>
                <p className="mt-4 text-2xl font-bold">
                  1 wallet = 1 opportunity
                </p>
                <p className="mt-4 text-sm leading-7 text-zinc-400">
                  Your participation history is derived from the GenLayer
                  participant and winner records. Local profile data never
                  decides whether you won or lost.
                </p>
                <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-widest text-zinc-600">
                    Wallet
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-zinc-300">
                    {address}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                ["Joined", joinedCount],
                ["Wins", wins],
                ["Losses", losses],
                ["Pending", pending],
                ["Favorites", favoriteIds.length],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"
                >
                  <p className="text-sm text-zinc-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-500">Win rate</p>
                <p className="mt-2 text-3xl font-bold">{winRate}%</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Wins ÷ all joined Prollys
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <p className="text-sm text-zinc-500">Win / loss ratio</p>
                <p className="mt-2 text-3xl font-bold">{winLossRatio}</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Wins ÷ finalized losses
                </p>
              </div>
            </div>

            <div className="mt-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
                    History
                  </p>
                  <h2 className="mt-3 text-3xl font-bold">
                    Your Prollys
                  </h2>
                </div>

                <p className="text-sm text-zinc-500">
                  Winners and losses come from GenLayer.
                </p>
              </div>

              {error && (
                <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
                  Failed to load your on-chain history: {error}
                </div>
              )}

              {loading ? (
                <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-10 text-center text-zinc-500">
                  Loading your GenLayer history...
                </div>
              ) : participations.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-10">
                  <p className="text-lg font-semibold">
                    You have not joined a Prolly yet.
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Explore active Prollys and your first participation will
                    appear here.
                  </p>
                  <Link
                    href="/prollys"
                    className="mt-6 inline-flex rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
                  >
                    Explore Prollys
                  </Link>
                </div>
              ) : (
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {participations.map((item) => {
                    const statusClass =
                      item.status === "won"
                        ? "border-green-500/30 bg-green-500/10 text-green-300"
                        : item.status === "lost"
                          ? "border-red-500/20 bg-red-500/5 text-red-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-300";

                    return (
                      <article
                        key={item.chain.id.toString()}
                        className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-zinc-600">
                              Prolly #{item.chain.id.toString()}
                            </p>
                            <h3 className="mt-2 text-xl font-bold">
                              {item.local.title || item.chain.name}
                            </h3>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-zinc-500">Entry</p>
                            <p className="mt-1 font-medium">
                              {formatGen(item.chain.entryFee)} GEN
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Winners</p>
                            <p className="mt-1 font-medium">
                              {item.chain.winnerCount.toString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Participants</p>
                            <p className="mt-1 font-medium">
                              {item.chain.participantCount.toString()} /{" "}
                              {item.chain.maxParticipants.toString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-zinc-500">Creator</p>
                            <p className="mt-1 font-medium">
                              @{item.local.creatorUsername || "admin"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <Link
                            href={`/prollys/${item.chain.id.toString()}`}
                            className="flex-1 rounded-full border border-zinc-700 px-4 py-3 text-center text-sm font-semibold hover:bg-zinc-800"
                          >
                            View Prolly
                          </Link>

                          {item.chain.winnersFinalized && (
                            <Link
                              href={`/prollys/${item.chain.id.toString()}/battle?replay=1`}
                              className="flex-1 rounded-full bg-violet-500 px-4 py-3 text-center text-sm font-semibold hover:bg-violet-400"
                            >
                              View Battle
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
