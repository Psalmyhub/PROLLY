"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import {
  getOnChainProlly,
  getWinners,
  hasJoinedProlly,
  type OnChainProlly,
} from "@/lib/genlayer";
import { loadProfile } from "@/lib/profile-store";
import { loadProllys, type Prolly } from "@/lib/prolly-store";

function usernameForWinner(walletAddress: string, prolly: Prolly | null): string {
  const normalized = walletAddress.toLowerCase();
  const participant = (prolly?.participantList ?? []).find(
    (item) => item.walletAddress?.toLowerCase() === normalized,
  );

  if (participant?.username) return participant.username;

  const profile = loadProfile(walletAddress);
  return profile?.username || "Winner";
}

function getLocalMetadata(onChain: OnChainProlly): Prolly | null {
  return (
    loadProllys().find((item) => item.onChainId === onChain.id.toString()) ??
    null
  );
}

const BATTLE_EVENTS = [
  "{name} was bitten by a snake.",
  "{name} slipped and fell into a river.",
  "{name} was caught in a sudden storm.",
  "{name} was trapped in a collapsing tunnel.",
  "{name} got lost in the forest.",
  "{name} was caught in a car crash.",
  "{name} stepped into a hidden trap.",
  "{name} was chased out of the arena.",
  "{name} was stranded on a broken bridge.",
  "{name} was swept away by a strong current.",
  "{name} was caught in a landslide.",
  "{name} could not escape the burning building.",
  "{name} was struck by a falling object.",
  "{name} missed the final checkpoint.",
  "{name} was trapped behind a locked gate.",
  "{name} was caught in a dangerous maze.",
  "{name} lost the final survival challenge.",
  "{name} was separated from the group.",
  "{name} was caught in a freezing storm.",
  "{name} fell behind during the final chase.",
  "{name} was unable to cross the finish line.",
  "{name} was caught outside the safe zone.",
  "{name} missed the final signal.",
  "{name} was eliminated in the last challenge.",
  "{name} was caught by a surprise ambush.",
  "{name} could not make it through the final round.",
  "{name} was forced to surrender.",
  "{name} was the final player eliminated.",
];

function buildBattleEvents(
  participants: Array<{ username: string; walletAddress?: string }>,
  winnerAddresses: string[],
) {
  const winnerSet = new Set(winnerAddresses.map((address) => address.toLowerCase()));
  const losers = participants.filter(
    (participant) =>
      participant.walletAddress &&
      !winnerSet.has(participant.walletAddress.toLowerCase()),
  );

  const events = losers.map((participant, index) => ({
    text: BATTLE_EVENTS[index % BATTLE_EVENTS.length].replace(
      "{name}",
      participant.username || "Player",
    ),
    winner: false,
  }));

  const winners = participants.filter(
    (participant) =>
      participant.walletAddress &&
      winnerSet.has(participant.walletAddress.toLowerCase()),
  );

  winners.forEach((winner, index) => {
    events.push({
      text:
        winners.length === 1
          ? `${winner.username || "Player"} survived. Winner ${winner.username || "Player"}!`
          : `${winner.username || "Player"} survived. Winner #${index + 1}: ${winner.username || "Player"}.`,
      winner: true,
    });
  });

  return events;
}

export default function ProllyBattlePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { address } = useAccount();

  const id = String(params.id);
  const replay = searchParams.get("replay") === "1";

  const [onChain, setOnChain] = useState<OnChainProlly | null>(null);
  const [prolly, setProlly] = useState<Prolly | null>(null);
  const [joined, setJoined] = useState(false);
  const [winnerAddresses, setWinnerAddresses] = useState<string[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [battleEventIndex, setBattleEventIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBattle() {
      try {
        setLoading(true);
        setError(null);

        const numericId = BigInt(id);
        const chainData = await getOnChainProlly(numericId);

        if (!chainData) {
          throw new Error("This Prolly could not be found on GenLayer.");
        }

        if (!chainData.winnersFinalized) {
          throw new Error(
            "The Battle has not started because winners have not been finalized on-chain.",
          );
        }

        if (!chainData.randomSeed) {
          throw new Error(
            "GenLayer has finalized the Prolly, but the random selection result is not ready yet.",
          );
        }

        const winners = await getWinners(numericId.toString());
        const localMetadata = getLocalMetadata(chainData);

        let walletJoined = false;
        if (address) {
          walletJoined = await hasJoinedProlly(
            numericId.toString(),
            address,
          );
        }

        if (!cancelled) {
          setOnChain(chainData);
          setProlly(localMetadata);
          setJoined(walletJoined);
          setWinnerAddresses(winners);
          setRevealedCount(0);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("Failed to load Prolly Battle:", loadError);
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBattle();
    return () => {
      cancelled = true;
    };
  }, [address, id]);

  const winners = useMemo(
    () =>
      winnerAddresses.map((walletAddress, index) => ({
        walletAddress,
        username: usernameForWinner(walletAddress, prolly),
        place: index + 1,
      })),
    [winnerAddresses, prolly],
  );

  const canWatch = joined || replay;

  const battleEvents = useMemo(
    () => buildBattleEvents(prolly?.participantList ?? [], winnerAddresses),
    [prolly, winnerAddresses],
  );

  const visibleBattleEvents = battleEvents.slice(0, battleEventIndex);

  useEffect(() => {
    if (!canWatch || (winners.length === 0 && battleEvents.length === 0)) return;

    setBattleEventIndex(0);
    setRevealedCount(0);

    const timer = window.setInterval(() => {
      setBattleEventIndex((current) => {
        if (current >= battleEvents.length) {
          window.clearInterval(timer);
          return current;
        }

        return current + 1;
      });
    }, 1100);

    return () => window.clearInterval(timer);
  }, [canWatch, battleEvents, winners.length, id]);

  useEffect(() => {
    setRevealedCount(
      battleEvents
        .slice(0, battleEventIndex)
        .filter((event) => event.winner).length,
    );
  }, [battleEventIndex, battleEvents]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
            GenLayer Battle
          </p>
          <h1 className="mt-4 text-4xl font-black">Loading Battle...</h1>
          <p className="mt-4 text-zinc-400">
            Reading the finalized winners from GenLayer.
          </p>
        </div>
      </main>
    );
  }

  if (error || !onChain) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/30 bg-red-500/5 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-red-300">
            Battle unavailable
          </p>
          <h1 className="mt-3 text-3xl font-black">No live Battle yet</h1>
          <p className="mt-4 text-zinc-300">{error || "Unknown Prolly."}</p>
          <Link
            href={`/prollys/${id}`}
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            Back to Prolly
          </Link>
        </div>
      </main>
    );
  }

  if (!canWatch) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
            Battle access
          </p>
          <h1 className="mt-4 text-4xl font-black">You did not join this Prolly</h1>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Live Battle viewing is reserved for participants. After the Battle,
            the replay can be watched from the Prolly page.
          </p>
          <Link
            href={`/prollys/${id}`}
            className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-black"
          >
            Back to Prolly
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-zinc-500">
            {replay ? "Battle Replay" : "Live Battle"}
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">{onChain.name}</h1>
          <p className="mt-4 text-zinc-400">
            {replay
              ? "Replay of the authoritative on-chain winner reveal."
              : "The winner set is already finalized on-chain. This Battle only reveals it."}
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Status</p>
              <p className="mt-2 font-bold text-emerald-300">FINALIZED ON-CHAIN</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Winners</p>
              <p className="mt-2 text-2xl font-black">{winners.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-xs uppercase tracking-widest text-zinc-500">Authority</p>
              <p className="mt-2 font-bold">GenLayer</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
            <p className="font-bold text-emerald-300">TRANSPARENT RANDOMNESS</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Participants were recorded on-chain, the pool was frozen, GenLayer
              finalized the winner set, and those same winners are being revealed
              here. The Battle does not generate or replace winners.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Battle story</p>
            <div className="mt-4 space-y-3">
              {visibleBattleEvents.map((event, index) => (
                <div key={`${index}-${event.text}`} className={`rounded-xl border p-4 ${event.winner ? "border-emerald-400/30 bg-emerald-400/5" : "border-white/10 bg-black/20"}`}>
                  <p className="text-sm leading-6 text-zinc-200">{event.text}</p>
                  {event.winner && <p className="mt-2 text-xs font-bold uppercase tracking-widest text-emerald-300">WINNER — VERIFIED ON-CHAIN</p>}
                </div>
              ))}
              {visibleBattleEvents.length === 0 && <p className="text-sm text-zinc-500">The Battle is about to begin...</p>}
            </div>
          </div>

          <div className="mt-10 space-y-4">
            {winners.map((winner, index) => {
              const revealed = index < revealedCount;
              return (
                <div
                  key={`${winner.walletAddress}-${winner.place}`}
                  className={`overflow-hidden rounded-2xl border p-5 transition-all duration-500 ${
                    revealed
                      ? "border-white/20 bg-white/[0.06]"
                      : "border-white/5 bg-black/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-zinc-500">
                        Winner #{winner.place}
                      </p>
                      <p
                        className={`mt-2 text-2xl font-black transition-all duration-500 ${
                          revealed ? "opacity-100 blur-0" : "opacity-40 blur-sm"
                        }`}
                      >
                        {revealed ? winner.username : "REVEALING..."}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">ON-CHAIN</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-300">
                        VERIFIED
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {winners.length === 0 && (
            <p className="mt-8 text-center text-zinc-400">
              No winners were returned from the finalized on-chain result.
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/prollys/${id}`}
            className="rounded-xl border border-white/10 px-5 py-3 font-semibold text-zinc-200 hover:bg-white/5"
          >
            Back to Prolly
          </Link>
          {!replay && (
            <Link
              href={`/prollys/${id}/battle?replay=1`}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black"
            >
              Watch Replay
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
