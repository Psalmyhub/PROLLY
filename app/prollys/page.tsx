"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect } from "wagmi";
import { loadFavoriteProllyIds, toggleFavoriteProlly } from "@/lib/favorite-store";

import { loadProllys, saveProllys, type Prolly } from "@/lib/prolly-store";
import {
  getAllOnChainProllys,
  hasJoinedProlly,
  joinProlly as joinOnChainProlly,
  type OnChainProlly,
} from "@/lib/genlayer";

type StatusFilter = "all" | "active" | "closing-soon" | "closed" | "favorites";
type CreatorFilter = "all" | "admin" | "sponsor";

function formatGen(value: bigint): string {
  const whole = value / BigInt("1000000000000000000");
  const fraction = value % BigInt("1000000000000000000");
  if (fraction === BigInt(0)) return whole.toString();
  return `${whole}.${fraction.toString().padStart(18, "0").replace(/0+$/, "")}`;
}

function genToNumber(value: bigint): number {
  return Number(formatGen(value));
}

function getLocalMetadata(onChain: OnChainProlly, localProllys: Prolly[]): Prolly {
  const existing = localProllys.find((item) => item.onChainId === onChain.id.toString());
  if (existing) {
    return {
      ...existing,
      title: existing.title || onChain.name,
      entryAmount: genToNumber(onChain.entryFee),
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
    entryAmount: genToNumber(onChain.entryFee),
    participants: Number(onChain.participantCount),
    maxParticipants: Number(onChain.maxParticipants),
    winners: Number(onChain.winnerCount),
    closingMode: "participants",
    createdAt: Date.now(),
  };
}

function getPostType(prolly: Prolly): "manual" | "link" | "admin" {
  if (prolly.creatorRole === "admin") return "admin";
  return prolly.sponsorCategory === "manual" ? "manual" : "link";
}

function getStatus(chain: OnChainProlly, prolly: Prolly): StatusFilter {
  if (chain.closed || chain.participantCount >= chain.maxParticipants) return "closed";
  if (prolly.closesAt && prolly.closesAt > Date.now() && prolly.closesAt - Date.now() <= 24 * 60 * 60 * 1000) {
    return "closing-soon";
  }
  return "active";
}

export default function ProllysPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const [mounted, setMounted] = useState(false);
  const [prollys, setProllys] = useState<Prolly[]>([]);
  const [onChainProllys, setOnChainProllys] = useState<OnChainProlly[]>([]);
  const [joinedStates, setJoinedStates] = useState<Record<string, boolean>>({});
  const [selectedProlly, setSelectedProlly] = useState<Prolly | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [creatorFilter, setCreatorFilter] = useState<CreatorFilter>("all");
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setFavorites(address ? loadFavoriteProllyIds(address) : []);
  }, [address]);

  function toggleFavorite(id: string) {
    if (!address) return;
    setFavorites(toggleFavoriteProlly(address, id));
  }

  async function loadData() {
    if (!mounted) return;
    try {
      setLoading(true);
      const onChain = await getAllOnChainProllys();
      setOnChainProllys(onChain);
      const local = loadProllys();
      const merged = onChain
        .map((item) => getLocalMetadata(item, local))
        .sort((a, b) => Number(b.onChainId || 0) - Number(a.onChainId || 0));
      setProllys(merged);
      saveProllys(merged);

      if (address) {
        const joinedEntries = await Promise.all(
          onChain.map(async (item) => {
            try {
              return [item.id.toString(), await hasJoinedProlly(item.id, address)] as const;
            } catch (error) {
              console.error(`Failed to check join status for Prolly ${item.id}:`, error);
              return [item.id.toString(), false] as const;
            }
          }),
        );
        setJoinedStates(Object.fromEntries(joinedEntries));
      } else {
        setJoinedStates({});
      }
    } catch (error) {
      console.error("Failed to load Prollys from GenLayer:", error);
      alert(`Failed to load Prollys from GenLayer: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, address]);

  function handleJoinClick(prolly: Prolly) {
    if (isConnecting || joining) return;
    const chain = onChainProllys.find((item) => item.id.toString() === prolly.onChainId);
    if (!chain) return alert("This Prolly could not be found on GenLayer.");
    if (chain.closed) return alert("This Prolly is closed.");
    if (chain.participantCount >= chain.maxParticipants) return alert("This Prolly is full.");

    if (!isConnected) {
      const connector = connectors.find((item) => item.name.toLowerCase().includes("metamask")) ?? connectors.find((item) => item.type === "injected");
      if (!connector) return alert("MetaMask connector not found. Please make sure MetaMask is installed and unlocked.");
      connect(
        { connector },
        {
          onSuccess: () => setSelectedProlly(prolly),
          onError: (error) => alert(`Wallet connection failed: ${error instanceof Error ? error.message : "Unknown error"}`),
        },
      );
      return;
    }

    if (joinedStates[prolly.onChainId ?? ""]) return alert("This wallet has already joined this Prolly.");
    if (prolly.sponsorCategory === "task" && taskSubmissions[prolly.onChainId ?? ""]?.status !== "qualified") {
      return alert("Complete and qualify the Task submission before joining this Task Prolly.");
    }
    setSelectedProlly(prolly);
  }

  async function handleJoin() {
    if (joining) return;
    if (!address || !isConnected) return alert("Please connect your wallet first.");
    if (!selectedProlly?.onChainId) return alert("This Prolly does not have a valid GenLayer ID.");

    const chain = onChainProllys.find((item) => item.id.toString() === selectedProlly.onChainId);
    if (!chain) return alert("This Prolly could not be found on GenLayer.");
    if (chain.closed || chain.participantCount >= chain.maxParticipants) {
      setSelectedProlly(null);
      return alert(chain.closed ? "This Prolly is closed." : "This Prolly is full.");
    }
    if (joinedStates[selectedProlly.onChainId]) {
      setSelectedProlly(null);
      return alert("This wallet has already joined this Prolly.");
    }

    try {
      setJoining(true);
      alert(`Joining with ${formatGen(chain.entryFee)} GEN. Please confirm the GenLayer transaction in MetaMask.`);
      await joinOnChainProlly(address, chain.id, chain.entryFee);
      setSelectedProlly(null);
      alert("Successfully joined the Prolly on GenLayer.");
      await loadData();
    } catch (error) {
      console.error("GenLayer join failed:", error);
      alert(`Join failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setJoining(false);
    }
  }

  const filteredProllys = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prollys.filter((prolly) => {
      const chain = onChainProllys.find((item) => item.id.toString() === prolly.onChainId);
      if (!chain) return false;
      const searchable = [prolly.title, prolly.description, prolly.creatorUsername, prolly.sponsorCategory ?? ""].join(" ").toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (creatorFilter !== "all" && prolly.creatorRole !== creatorFilter) return false;
      if (statusFilter === "favorites" && !favorites.includes(prolly.onChainId ?? prolly.id)) return false;
      if (statusFilter !== "all" && statusFilter !== "favorites" && getStatus(chain, prolly) !== statusFilter) return false;
      return true;
    });
  }, [prollys, onChainProllys, search, creatorFilter, typeFilter, favoritesOnly, favorites, statusFilter]);

  if (!mounted) {
    return <main className="min-h-screen bg-zinc-950 text-white"><div className="flex min-h-screen items-center justify-center"><p className="text-zinc-400">Loading...</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">PROLLY<span className="text-violet-400">.</span></Link>
          <Link href="/" className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800">Home</Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">Explore</p>
            <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Choose your Prolly.</h1>
            <p className="mt-5 text-lg leading-8 text-zinc-400">Discover active Prollys. Every participant gets one opportunity.</p>
          </div>
          <button onClick={loadData} disabled={loading} className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">{loading ? "Refreshing..." : "Refresh"}</button>
        </div>

        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, creator, sponsor, description..." className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-violet-500" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm"><option value="all">All Statuses</option><option value="active">Live</option><option value="closing-soon">Starting Soon</option><option value="closed">Closed</option><option value="favorites">Favorites</option></select>
            <select value={creatorFilter} onChange={(event) => setCreatorFilter(event.target.value as CreatorFilter)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm"><option value="all">All Creators</option><option value="admin">Admin</option><option value="sponsor">Sponsor</option></select>

          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/5 px-5 py-4"><p className="text-sm text-green-300">{onChainProllys.length} Prolly{onChainProllys.length === 1 ? "" : "s"} currently registered on GenLayer.</p></div>

        {loading ? (
          <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center"><p className="text-zinc-400">Loading Prollys from GenLayer...</p></div>
        ) : filteredProllys.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center"><p className="text-lg font-semibold">No Prollys match your filters.</p><p className="mt-2 text-sm text-zinc-500">Try clearing search or changing the filters.</p></div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProllys.map((prolly) => {
              const chain = onChainProllys.find((item) => item.id.toString() === prolly.onChainId);
              if (!chain) return null;
              const participantCount = Number(chain.participantCount);
              const maxParticipants = Number(chain.maxParticipants);
                const isClosed = chain.closed;
              const isJoined = !!prolly.onChainId && !!joinedStates[prolly.onChainId];
              const isFinalized = chain.winnersFinalized;
              const canReveal = isFinalized && !!chain.randomSeed;
              const isFavorite = favorites.includes(prolly.onChainId ?? prolly.id);
              const progress = maxParticipants > 0 ? Math.min((participantCount / maxParticipants) * 100, 100) : 0;
              const status = getStatus(chain, prolly);
              const postType = prolly.creatorRole === "sponsor" ? getPostType(prolly) : "all";

              return (
                <article key={chain.id.toString()} className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50">
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase text-violet-400">{prolly.creatorRole}</span>{prolly.creatorRole === "sponsor" && <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">{getPostType(prolly) === "manual" ? "Manual Prolly" : "Link Prolly"}</span>}</div>
                        <h2 className="mt-3 text-2xl font-bold">{prolly.title || chain.name || "Untitled Prolly"}</h2>
                      </div>
                      <button onClick={() => toggleFavorite(prolly.onChainId ?? prolly.id)} aria-label={isFavorite ? "Remove favorite" : "Add favorite"} className="text-2xl leading-none text-zinc-400 hover:text-white">{isFavorite ? "♥" : "♡"}</button>
                    </div>

                    <p className="mt-3 min-h-14 text-sm leading-6 text-zinc-400">{prolly.description || "No description provided."}</p>
                    <div className="mt-6 flex h-40 items-center justify-center rounded-2xl bg-zinc-800"><span className="text-sm text-zinc-600">Prolly image</span></div>

                    <div className="mt-6 flex items-center justify-between text-sm"><div><p className="text-zinc-500">Creator</p><p className="mt-1 font-medium">@{prolly.creatorUsername || "admin"}</p></div><div className="text-right"><p className="text-zinc-500">Status</p><p className="mt-1 font-medium capitalize">{status.replace("-", " ")}</p></div></div>

                    <div className="mt-5 space-y-3 text-sm">
                      {prolly.creatorRole === "sponsor" ? <><div className="flex justify-between"><span className="text-zinc-500">Maximum Participants</span><span className="font-medium">{maxParticipants}</span></div><div className="flex justify-between"><span className="text-zinc-500">Winners</span><span className="font-medium">{chain.winnerCount.toString()}</span></div><div className="flex justify-between"><span className="text-zinc-500">{getPostType(prolly) === "manual" ? "Participants" : "Participants Joined"}</span><span className="font-medium">{participantCount} / {maxParticipants}</span></div></> : <><div className="flex justify-between"><span className="text-zinc-500">Entry</span><span className="font-medium">{formatGen(chain.entryFee)} GEN</span></div><div className="flex justify-between"><span className="text-zinc-500">Participants</span><span className="font-medium">{participantCount} / {maxParticipants}</span></div><div className="flex justify-between"><span className="text-zinc-500">Winners</span><span className="font-medium">{chain.winnerCount.toString()}</span></div></>}
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} /></div>

                    <div className="mt-6 flex gap-3">
                      {!isClosed && !isJoined ? (
                        <button onClick={() => handleJoinClick(prolly)} disabled={joining || isConnecting || (prolly.sponsorCategory === "task" && !taskReady)} className="flex-1 rounded-full bg-violet-500 px-5 py-3 font-semibold hover:bg-violet-400 disabled:opacity-50">{prolly.sponsorCategory === "task" && !taskReady ? "Qualify Task First" : joining ? "Joining..." : "Join Prolly"}</button>
                      ) : !isClosed && isJoined ? (
                        <button disabled className="flex-1 cursor-not-allowed rounded-full border border-green-500/30 bg-green-500/10 px-5 py-3 font-semibold text-green-300">Joined</button>
                      ) : isClosed && isJoined && !isFinalized ? (
                        <Link
                          href={`/prollys/${prolly.onChainId}`}
                          className="flex-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-center font-semibold text-amber-300 hover:bg-amber-500/20"
                        >
                          Finalize / Authorize GenLayer
                        </Link>
                      ) : isClosed && isJoined && isFinalized && !canReveal ? (
                        <button disabled className="flex-1 cursor-not-allowed rounded-full border border-zinc-700 px-5 py-3 font-semibold text-zinc-500">Waiting for random selection</button>
                      ) : isClosed && isJoined && canReveal ? (
                        <Link href={`/prollys/${prolly.onChainId}`} className="flex-1 rounded-full bg-violet-500 px-5 py-3 text-center font-semibold hover:bg-violet-400">View Winner / Battle</Link>
                      ) : (
                        <button disabled className="flex-1 cursor-not-allowed rounded-full border border-zinc-700 px-5 py-3 font-semibold text-zinc-500">Prolly Closed</button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedProlly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">Confirm entry</p>
            <h2 className="mt-3 text-2xl font-bold">{selectedProlly.title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">You receive exactly one opportunity in this Prolly. The GenLayer contract records the participant and controls the authoritative winner selection.</p>
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex justify-between text-sm"><span className="text-zinc-500">Entry</span><span className="font-semibold">{formatGen(onChainProllys.find((item) => item.id.toString() === selectedProlly.onChainId)?.entryFee ?? BigInt(0))} GEN</span></div></div>
            <div className="mt-6 flex gap-3"><button onClick={() => setSelectedProlly(null)} disabled={joining} className="flex-1 rounded-full border border-zinc-700 px-5 py-3 font-semibold hover:bg-zinc-900 disabled:opacity-50">Cancel</button><button onClick={handleJoin} disabled={joining} className="flex-1 rounded-full bg-violet-500 px-5 py-3 font-semibold hover:bg-violet-400 disabled:opacity-50">{joining ? "Joining..." : "Confirm Join"}</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
