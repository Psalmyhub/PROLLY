"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect } from "wagmi";

import {
  getOnChainProlly,
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

function formatGen(value: bigint): string {
  const whole =
    value /
    BigInt("1000000000000000000");

  const fraction =
    value %
    BigInt("1000000000000000000");

  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  const fractionText =
    fraction
      .toString()
      .padStart(18, "0")
      .replace(/0+$/, "");

  return `${whole.toString()}.${fractionText}`;
}

function getLocalMetadata(
  onChain: OnChainProlly,
  localProllys: Prolly[],
): Prolly {
  const existing =
    localProllys.find(
      (item) =>
        item.onChainId ===
        onChain.id.toString(),
    );

  if (existing) {
    return {
      ...existing,
      title:
        existing.title ||
        onChain.name,
      entryAmount: Number(
        formatGen(
          onChain.entryFee,
        ),
      ),
      participants: Number(
        onChain.participantCount,
      ),
      maxParticipants: Number(
        onChain.maxParticipants,
      ),
      winners: Number(
        onChain.winnerCount,
      ),
    };
  }

  return {
    id: `onchain-${onChain.id.toString()}`,
    onChainId:
      onChain.id.toString(),
    title: onChain.name,
    description: "",
    creatorUsername: "Admin",
    creatorRole: "admin",
    entryAmount: Number(
      formatGen(
        onChain.entryFee,
      ),
    ),
    participants: Number(
      onChain.participantCount,
    ),
    maxParticipants: Number(
      onChain.maxParticipants,
    ),
    winners: Number(
      onChain.winnerCount,
    ),
    closingMode: "participants",
    createdAt: Date.now(),
  };
}

export default function ProllyDetailsPage() {
  const params = useParams();

  const {
    address,
    isConnected,
  } = useAccount();

  const {
    connect,
    connectors,
    isPending: isConnecting,
  } = useConnect();

  const id = String(params.id);

  const [mounted, setMounted] =
    useState(false);

  const [prolly, setProlly] =
    useState<Prolly | null>(null);

  const [onChain, setOnChain] =
    useState<OnChainProlly | null>(null);

  const [joined, setJoined] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [joining, setJoining] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadData() {
    if (!mounted) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const numericId =
        BigInt(id);

      const chainData =
        await getOnChainProlly(
          numericId,
        );

      if (!chainData) {
        setOnChain(null);
        setProlly(null);
        return;
      }

      setOnChain(chainData);

      const localProllys =
        loadProllys();

      const metadata =
        getLocalMetadata(
          chainData,
          localProllys,
        );

      setProlly(metadata);

      const updatedLocal = [
        ...localProllys.filter(
          (item) =>
            item.onChainId !== id,
        ),
        metadata,
      ];

      saveProllys(
        updatedLocal,
      );

      if (address) {
        const walletJoined =
          await hasJoinedProlly(
            numericId.toString(),
            address,
          );

        setJoined(
          walletJoined,
        );
      } else {
        setJoined(false);
      }
    } catch (loadError) {
      console.error(
        "Failed to load Prolly from GenLayer:",
        loadError,
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : String(loadError),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mounted,
    address,
    id,
  ]);

  async function handleJoin() {
    if (
      joining ||
      isConnecting
    ) {
      return;
    }

    if (
      !isConnected ||
      !address
    ) {
      const metaMaskConnector =
        connectors.find(
          (connector) =>
            connector.name
              .toLowerCase()
              .includes("metamask"),
        ) ??
        connectors.find(
          (connector) =>
            connector.type ===
            "injected",
        );

      if (!metaMaskConnector) {
        alert(
          "MetaMask connector not found. Please make sure MetaMask is installed and unlocked.",
        );
        return;
      }

      connect(
        {
          connector:
            metaMaskConnector,
        },
        {
          onSuccess: () => {
            void loadData();
          },
          onError: (
            connectError,
          ) => {
            console.error(
              "Wallet connection failed:",
              connectError,
            );

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
      alert(
        "This Prolly could not be found on GenLayer.",
      );
      return;
    }

    if (onChain.closed) {
      alert(
        "This Prolly is closed.",
      );
      return;
    }

    if (
      onChain.participantCount >=
      onChain.maxParticipants
    ) {
      alert(
        "This Prolly is full.",
      );
      return;
    }

    if (joined) {
      alert(
        "This wallet has already joined this Prolly.",
      );
      return;
    }

    try {
      setJoining(true);

      /*
       * The contract requires the exact entry fee.
       * No additional 5% platform fee is added here.
       */
      const payment =
        onChain.entryFee;

      alert(
        `Joining with ${formatGen(payment)} GEN. Please confirm the GenLayer transaction in MetaMask.`,
      );

      await joinOnChainProlly(
        address,
        onChain.id.toString(),
        payment,
      );

      alert(
        "Join transaction submitted successfully on GenLayer.",
      );

      await loadData();
    } catch (joinError) {
      console.error(
        "GenLayer join failed:",
        joinError,
      );

      const message =
        joinError instanceof Error
          ? joinError.message
          : String(joinError);

      alert(
        `Join failed: ${message}`,
      );
    } finally {
      setJoining(false);
    }
  }

  const participantCount =
    onChain
      ? Number(
          onChain.participantCount,
        )
      : 0;

  const maxParticipants =
    onChain
      ? Number(
          onChain.maxParticipants,
        )
      : 0;

  const progress =
    maxParticipants > 0
      ? Math.min(
          (participantCount /
            maxParticipants) *
            100,
          100,
        )
      : 0;

  const status = useMemo(() => {
    if (!onChain) {
      return "NOT FOUND";
    }

    if (onChain.closed) {
      return "CLOSED";
    }

    if (
      onChain.participantCount >=
      onChain.maxParticipants
    ) {
      return "FULL";
    }

    return "LIVE";
  }, [onChain]);

  if (
    !mounted ||
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400" />

          <p className="mt-5 text-zinc-400">
            Loading Prolly from GenLayer...
          </p>
        </div>
      </main>
    );
  }

  if (
    error ||
    !prolly ||
    !onChain
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="max-w-lg text-center">
          <h1 className="text-4xl font-bold">
            Prolly not found
          </h1>

          <p className="mt-4 text-zinc-500">
            {error ||
              "This Prolly does not exist on GenLayer."}
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
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight"
          >
            PROLLY
            <span className="text-violet-400">
              .
            </span>
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

              <p className="mt-5 text-sm text-zinc-500">
                Prolly image
              </p>

              <p className="mt-2 text-xs text-zinc-600">
                Image can be added later
              </p>
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
                {participantCount}/
                {maxParticipants} joined
              </span>
            </div>

            <h1 className="mt-5 text-5xl font-bold tracking-tight">
              {prolly.title}
            </h1>

            <p className="mt-6 text-lg leading-8 text-zinc-400">
              {prolly.description ||
                "Join this Prolly for a chance to become one of the randomly selected winners."}
            </p>

            <div className="mt-7">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">
                  Participation
                </span>

                <span className="text-zinc-300">
                  {participantCount} /{" "}
                  {maxParticipants}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">
                  Entry fee
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {formatGen(
                    onChain.entryFee,
                  )}{" "}
                  GEN
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">
                  Participants
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {participantCount}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">
                  Winners
                </p>

                <p className="mt-2 text-2xl font-bold">
                  {onChain.winnerCount.toString()}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">
                  Selection
                </p>

                <p className="mt-2 text-2xl font-bold">
                  Random
                </p>
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={
                joined ||
                onChain.closed ||
                onChain.participantCount >=
                  onChain.maxParticipants ||
                joining ||
                isConnecting
              }
              className={`mt-8 w-full rounded-full py-4 text-lg font-semibold ${
                joined
                  ? "bg-emerald-500 text-black"
                  : onChain.closed ||
                      onChain.participantCount >=
                        onChain.maxParticipants
                    ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                    : "bg-violet-500 hover:bg-violet-400"
              }`}
            >
              {joined
                ? "Joined Prolly ✓"
                : onChain.closed
                  ? "Prolly Closed"
                  : onChain.participantCount >=
                      onChain.maxParticipants
                    ? "Prolly Full"
                    : joining
                      ? "Joining on GenLayer..."
                      : isConnecting
                        ? "Connecting..."
                        : isConnected
                          ? `Join Prolly — ${formatGen(
                              onChain.entryFee,
                            )} GEN`
                          : "Connect wallet to join"}
            </button>

            <p className="mt-4 text-center text-xs text-zinc-600">
              You pay exactly the configured
              entry fee. Entry amount does not
              change your probability of winning.
            </p>

            <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
              <p className="text-sm font-semibold text-green-300">
                GenLayer source of truth
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Participants, entry fee, winner
                count, and closed status are read
                directly from GenLayer.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-20 border-t border-zinc-800 pt-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              How this Prolly works
            </p>

            <h2 className="mt-4 text-3xl font-bold">
              Simple. Transparent. Random.
            </h2>

            <p className="mt-5 leading-8 text-zinc-400">
              Every wallet gets one opportunity.
              The entry amount does not give a
              participant extra chances. After the
              Prolly closes, the GenLayer contract
              performs the random winner selection.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7">
              <span className="text-sm font-semibold text-violet-400">
                01
              </span>

              <h3 className="mt-5 text-xl font-semibold">
                Join
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                Connect your wallet and pay the
                exact configured entry fee. Your
                wallet is recorded on-chain once.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7">
              <span className="text-sm font-semibold text-violet-400">
                02
              </span>

              <h3 className="mt-5 text-xl font-semibold">
                Close
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                The Prolly automatically closes when
                its participant limit is reached, or
                the admin can close it manually.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7">
              <span className="text-sm font-semibold text-violet-400">
                03
              </span>

              <h3 className="mt-5 text-xl font-semibold">
                Random selection
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                After closing, the GenLayer contract
                selects the configured number of
                unique winners.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Transparency
          </p>

          <h2 className="mt-4 text-2xl font-bold">
            Verify the important state on GenLayer.
          </h2>

          <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
            This page does not invent participant
            counts or Prolly status in the browser.
            Those values come from the deployed
            GenLayer contract.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="font-semibold">
                On-chain participation
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                The contract records each wallet
                that joins and prevents the same
                wallet from joining twice.
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="font-semibold">
                Random selection
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Winners are finalized by the Prolly
                contract after the Prolly closes.
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="font-semibold">
                Equal opportunity
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Each participant is represented once
                in the frozen participant list used
                for random selection.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
