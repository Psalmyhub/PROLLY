"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect } from "wagmi";

import {
  finalizeWinners,
  getOnChainProlly,
  getRandomSeed,
  getWinners,
  hasJoinedProlly,
  joinProlly as joinOnChainProlly,
  type OnChainProlly,
} from "@/lib/genlayer";

import {
  loadProllys,
  saveProllys,
  type Prolly,
} from "@/lib/prolly-store";

import { loadProfile } from "@/lib/profile-store";

import {
  loadTaskSubmission,
  saveTaskSubmission,
  type TaskSubmission,
} from "@/lib/task-store";

function formatGen(value: bigint): string {
  const whole = value / BigInt("1000000000000000000");
  const fraction = value % BigInt("1000000000000000000");

  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  const fractionText = fraction
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");

  return `${whole.toString()}.${fractionText}`;
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
      entryAmount: Number(formatGen(onChain.entryFee)),
      participants: Number(onChain.participantCount),
      maxParticipants: Number(onChain.maxParticipants),
      winners: Number(onChain.winnerCount),
    };
  }

  return {
    id: `onchain-${onChain.id.toString()}`,
    onChainId: onChain.id.toString(),
    title: onChain.name,
    description: "",
    creatorUsername: "Admin",
    creatorRole: "admin",
    entryAmount: Number(formatGen(onChain.entryFee)),
    participants: Number(onChain.participantCount),
    maxParticipants: Number(onChain.maxParticipants),
    winners: Number(onChain.winnerCount),
    closingMode: "participants",
    createdAt: Date.now(),
  };
}

function usernameForWinner(
  walletAddress: string,
  prolly: Prolly | null,
): string {
  const normalized = walletAddress.toLowerCase();
  const participant = (prolly?.participantList ?? []).find(
    (item) => item.walletAddress?.toLowerCase() === normalized,
  );

  if (participant?.username) {
    return participant.username;
  }

  const profile = loadProfile(walletAddress);
  if (profile?.username) {
    return profile.username;
  }

  return "Winner";
}

export default function ProllyDetailsPage() {
  const params = useParams();
  const { address, isConnected } = useAccount();
  const {
    connect,
    connectors,
    isPending: isConnecting,
  } = useConnect();

  const id = String(params.id);

  const [mounted, setMounted] = useState(false);
  const [prolly, setProlly] = useState<Prolly | null>(null);
  const [onChain, setOnChain] = useState<OnChainProlly | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [randomSeed, setRandomSeed] = useState<string>("");
  const [winnerAddresses, setWinnerAddresses] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [taskResponse, setTaskResponse] = useState("");
  const [taskReference, setTaskReference] = useState("");
  const [taskSubmission, setTaskSubmission] = useState<TaskSubmission | null>(null);
  const [submittingTask, setSubmittingTask] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadData() {
    if (!mounted) return;

    try {
      setLoading(true);
      setError(null);

      const numericId = BigInt(id);
      const chainData = await getOnChainProlly(numericId);

      if (!chainData) {
        setOnChain(null);
        setProlly(null);
        return;
      }

      setOnChain(chainData);

      const localProllys = loadProllys();
      const metadata = getLocalMetadata(chainData, localProllys);
      setProlly(metadata);

      const updatedLocal = [
        ...localProllys.filter((item) => item.onChainId !== id),
        metadata,
      ];
      saveProllys(updatedLocal);

      if (address) {
        const walletJoined = await hasJoinedProlly(
          numericId.toString(),
          address,
        );
        setJoined(walletJoined);
      } else {
        setJoined(false);
      }

      if (chainData.closed) {
        const seed = await getRandomSeed(numericId.toString());
        setRandomSeed(seed);

        if (chainData.winnersFinalized) {
          const winners = await getWinners(numericId.toString());
          setWinnerAddresses(winners);
        } else {
          setWinnerAddresses([]);
        }
      } else {
        setRandomSeed("");
        setWinnerAddresses([]);
      }
    } catch (loadError) {
      console.error("Failed to load Prolly from GenLayer:", loadError);
      setError(
        loadError instanceof Error ? loadError.message : String(loadError),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (address && prolly?.sponsorCategory === "task") {
      setTaskSubmission(loadTaskSubmission(id, address));
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, address, id]);

  async function handleFinalize() {
    if (finalizing || !onChain || !address) return;

    try {
      setFinalizing(true);
      setError(null);

      await finalizeWinners(address, onChain.id.toString());
      await loadData();
    } catch (finalizeError) {
      console.error("GenLayer winner finalization failed:", finalizeError);
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : String(finalizeError),
      );
    } finally {
      setFinalizing(false);
    }
  }

  async function handleJoin() {
    if (joining || isConnecting) return;

    if (!isConnected || !address) {
      const metaMaskConnector =
        connectors.find((connector) =>
          connector.name.toLowerCase().includes("metamask"),
        ) ??
        connectors.find((connector) => connector.type === "injected");

      if (!metaMaskConnector) {
        alert(
          "MetaMask connector not found. Please make sure MetaMask is installed and unlocked.",
        );
        return;
      }

      connect(
        { connector: metaMaskConnector },
        {
          onSuccess: () => void loadData(),
          onError: (connectError) => {
            console.error("Wallet connection failed:", connectError);
            alert(
              `Wallet connection failed: ${
                connectError instanceof Error
                  ? connectError.message
                  : "Unknown error"
              }`,
            );
          },
        },
      );
      return;
    }

    if (!onChain) {
      alert("This Prolly could not be found on GenLayer.");
      return;
    }

    if (onChain.closed) {
      alert("This Prolly is closed.");
      return;
    }

    if (onChain.participantCount >= onChain.maxParticipants) {
      alert("This Prolly is full.");
      return;
    }

    if (joined) {
      alert("This wallet has already joined this Prolly.");
      return;
    }

    try {
      setJoining(true);

      /*
       * The contract requires the exact entry fee.
       * No additional 5% platform fee is added here.
       */
      const payment = onChain.entryFee;

      alert(
        `Joining with ${formatGen(payment)} GEN. Please confirm the GenLayer transaction in MetaMask.`,
      );

      await joinOnChainProlly(
        address,
        onChain.id.toString(),
        payment,
      );

      alert("Join transaction submitted successfully on GenLayer.");
      await loadData();
    } catch (joinError) {
      console.error("GenLayer join failed:", joinError);

      const message =
        joinError instanceof Error ? joinError.message : String(joinError);

      alert(`Join failed: ${message}`);
    } finally {
      setJoining(false);
    }
  }

  const participantCount = onChain ? Number(onChain.participantCount) : 0;
  const maxParticipants = onChain ? Number(onChain.maxParticipants) : 0;

  const progress =
    maxParticipants > 0
      ? Math.min((participantCount / maxParticipants) * 100, 100)
      : 0;

  const status = useMemo(() => {
    if (!onChain) return "NOT FOUND";
    if (onChain.closed) return "CLOSED";
    if (onChain.participantCount >= onChain.maxParticipants) return "FULL";
    return "LIVE";
  }, [onChain]);

  const winnerUsernames = useMemo(
    () =>
      winnerAddresses.map((winner) => ({
        address: winner,
        username: usernameForWinner(winner, prolly),
      })),
    [winnerAddresses, prolly],
  );

  const liveBattleAvailable = joined && !!onChain?.winnersFinalized;
  const replayAvailable = !!onChain?.winnersFinalized && !joined;

  if (!mounted || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400" />
          <p className="mt-5 text-zinc-400">Loading Prolly from GenLayer...</p>
        </div>
      </main>
    );
  }

  if (error && (!prolly || !onChain)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="max-w-lg text-center">
          <h1 className="text-4xl font-bold">Prolly not found</h1>
          <p className="mt-4 text-zinc-500">{error}</p>
          <Link
            href="/prollys"
            className="mt-6 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
          >
            Explore Prollys
          </Link>
        </div>
      </main>
    );
  }

  if (!prolly || !onChain) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="max-w-lg text-center">
          <h1 className="text-4xl font-bold">Prolly not found</h1>
          <p className="mt-4 text-zinc-500">
            This Prolly does not exist on GenLayer.
          </p>
          <Link
            href="/prollys"
            className="mt-6 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
          >
            Explore Prollys
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            PROLLY<span className="text-violet-400">.</span>
          </Link>
          <Link
            href="/prollys"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          >
            Explore Prollys
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900">
            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-violet-500/10 text-4xl">
                🎲
              </div>
              <p className="mt-5 text-sm text-zinc-500">Prolly image</p>
              <p className="mt-2 text-xs text-zinc-600">Image can be added later</p>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  status === "LIVE"
                    ? "bg-green-500/10 text-green-400"
                    : status === "CLOSED"
                      ? "bg-zinc-800 text-zinc-400"
                      : "bg-yellow-500/10 text-yellow-400"
                }`}
              >
                {status}
              </span>
              <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                On-chain #{id}
              </span>
              <span className="text-sm text-zinc-500">
                {participantCount}/{maxParticipants} joined
              </span>
            </div>

            <h1 className="mt-5 text-5xl font-bold tracking-tight">
              {prolly.title}
            </h1>

            <p className="mt-6 text-lg leading-8 text-zinc-400">
              {prolly.description ||
                "Join this Prolly for a chance to become one of the randomly selected winners."}
            </p>

            {prolly.sponsorCategory === "task" && (
              <div className="mt-7 rounded-3xl border border-violet-500/20 bg-violet-500/5 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">
                      Sponsor Task
                    </p>
                    <h2 className="mt-2 text-xl font-bold">
                      Complete the task to qualify
                    </h2>
                  </div>
                  <span className="rounded-full border border-violet-500/30 px-3 py-1 text-xs text-violet-300">
                    1 task = 1 opportunity
                  </span>
                </div>

                {prolly.taskInstructions && (
                  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-widest text-zinc-600">
                      Rules / Instructions
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                      {prolly.taskInstructions}
                    </p>
                  </div>
                )}

                {prolly.taskPreference && (
                  <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <p className="text-xs uppercase tracking-widest text-zinc-600">
                      Submission preference
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {prolly.taskPreference}
                    </p>
                  </div>
                )}

                {prolly.taskReferenceImage && (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-widest text-zinc-600">
                      Reference
                    </p>
                    <a
                      href={prolly.taskReferenceImage}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block truncate text-sm text-violet-300 hover:text-violet-200"
                    >
                      {prolly.taskReferenceImage}
                    </a>
                  </div>
                )}

                <p className="mt-5 text-xs leading-5 text-zinc-600">
                  Task qualification must be completed before a participant
                  enters the authoritative random pool. This interface does
                  not select winners.
                </p>
              </div>
            )}

            {prolly.sponsorCategory === "task" && !joined && (
              <div className="mt-6 rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Task submission</p>
                <h2 className="mt-2 text-xl font-bold">Submit your task response</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Your submission is collected for qualification. It does not select a winner. The authoritative random pool remains controlled by the GenLayer contract.</p>
                {taskSubmission ? (
                  <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="font-semibold text-amber-300">Submission received — awaiting qualification</p>
                    <p className="mt-2 text-xs text-zinc-500">Submitted {new Date(taskSubmission.submittedAt).toLocaleString()}</p>
                  </div>
                ) : (
                  <>
                    <textarea value={taskResponse} onChange={(e) => setTaskResponse(e.target.value)} rows={5} placeholder="Enter your task response or submission..." className="mt-5 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
                    <input value={taskReference} onChange={(e) => setTaskReference(e.target.value)} placeholder="Optional proof/reference link" className="mt-3 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-cyan-400" />
                    <button onClick={() => { if (!address) { setError("Connect your wallet before submitting."); return; } if (!taskResponse.trim()) { setError("Enter a task response first."); return; } setSubmittingTask(true); try { const submission: TaskSubmission = { prollyId: id, wallet: address, response: taskResponse.trim(), reference: taskReference.trim(), submittedAt: Date.now(), status: "pending" }; saveTaskSubmission(submission); setTaskSubmission(submission); setTaskResponse(""); setTaskReference(""); } finally { setSubmittingTask(false); } }} disabled={!address || submittingTask} className="mt-4 w-full rounded-full bg-cyan-400 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500">{submittingTask ? "Submitting..." : "Submit for Qualification"}</button>
                  </>
                )}
              </div>
            )}

            <div className="mt-7">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Participation</span>
                <span className="text-zinc-300">
                  {participantCount} / {maxParticipants}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">Entry fee</p>
                <p className="mt-2 text-2xl font-bold">
                  {formatGen(onChain.entryFee)} GEN
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">Participants</p>
                <p className="mt-2 text-2xl font-bold">{participantCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">Winners</p>
                <p className="mt-2 text-2xl font-bold">
                  {onChain.winnerCount.toString()}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">Selection</p>
                <p className="mt-2 text-2xl font-bold">Random</p>
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={
                joined ||
                onChain.closed ||
                onChain.participantCount >= onChain.maxParticipants ||
                joining ||
                isConnecting
              }
              className={`mt-8 w-full rounded-full py-4 text-lg font-semibold ${
                joined
                  ? "bg-emerald-500 text-black"
                  : onChain.closed ||
                      onChain.participantCount >= onChain.maxParticipants
                    ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                    : "bg-violet-500 text-white hover:bg-violet-400"
              }`}
            >
              {joining
                ? "Joining..."
                : joined
                  ? "Joined — 1 Opportunity"
                  : onChain.closed
                    ? "Prolly Closed"
                    : onChain.participantCount >= onChain.maxParticipants
                      ? "Prolly Full"
                      : "Join Prolly"}
            </button>

            {onChain.closed && !onChain.winnersFinalized && (
              <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <p className="text-sm font-semibold text-amber-300">
                  Anyone can Authorize GenLayer for Random Selection
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  The Prolly is closed and frozen. Authorizing GenLayer begins
                  the authoritative random selection and finalizes the winners
                  on-chain.
                </p>
                <div className="mt-4">
                  <button
                    onClick={handleFinalize}
                    disabled={!address || finalizing}
                    className="w-full rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                  >
                    {finalizing ? "Authorizing GenLayer..." : "Authorize GenLayer"}
                  </button>
                </div>
                {!address && (
                  <p className="mt-3 text-xs text-zinc-600">
                    Connect any wallet to authorize GenLayer.
                  </p>
                )}
              </div>
            )}

            {onChain.winnersFinalized && (
              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-sm font-semibold text-emerald-300">
                  Winners Finalized On-Chain
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  GenLayer has finalized the winners. The Battle only reveals
                  these already-selected winners and never selects new ones.
                </p>
              </div>
            )}

            {onChain.closed && randomSeed && (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm font-semibold text-zinc-300">
                  Transparent Randomness
                </p>
                <div className="mt-3 space-y-2 text-sm text-zinc-500">
                  <p>✓ Participants recorded on-chain</p>
                  <p>✓ Pool frozen before selection</p>
                  <p>✓ Random seed generated</p>
                  <p>✓ Winners selected without replacement</p>
                  <p>✓ Winners stored on-chain</p>
                </div>
                <p className="mt-4 break-all font-mono text-xs text-zinc-700">
                  Seed: {randomSeed}
                </p>
              </div>
            )}

            {onChain.winnersFinalized && (
              <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
                <p className="text-sm font-semibold text-violet-300">
                  On-Chain Winners
                </p>
                <div className="mt-4 space-y-2">
                  {winnerUsernames.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      Winners are finalized, but the winner list is still loading.
                    </p>
                  ) : (
                    winnerUsernames.map((winner, index) => (
                      <div
                        key={`${winner.address}-${index}`}
                        className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3"
                      >
                        <span className="font-semibold">
                          {index + 1}. {winner.username}
                        </span>
                        <span className="text-xs text-emerald-400">
                          ON-CHAIN WINNER
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {onChain.winnersFinalized && (
              <div className="mt-6">
                {liveBattleAvailable ? (
                  <Link
                    href={`/prollys/${id}/battle`}
                    className="block w-full rounded-full bg-violet-500 py-4 text-center text-lg font-semibold hover:bg-violet-400"
                  >
                    View Battle
                  </Link>
                ) : replayAvailable ? (
                  <Link
                    href={`/prollys/${id}/battle?replay=1`}
                    className="block w-full rounded-full border border-violet-500/40 bg-violet-500/10 py-4 text-center text-lg font-semibold text-violet-300 hover:bg-violet-500/20"
                  >
                    Watch Battle Replay
                  </Link>
                ) : (
                  <div className="rounded-full border border-zinc-800 bg-zinc-900 py-4 text-center text-sm text-zinc-500">
                    Battle is available to participants and replay viewers.
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
