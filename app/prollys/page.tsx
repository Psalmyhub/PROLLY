"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect } from "wagmi";

import {
  loadProllys,
  saveProllys,
  type Prolly,
} from "@/lib/prolly-store";

import {
  getAllOnChainProllys,
  hasJoinedProlly,
  joinProlly as joinOnChainProlly,
  type OnChainProlly,
} from "@/lib/genlayer";

function formatGen(value: bigint): string {
  const whole =
    value / BigInt("1000000000000000000");

  const fraction =
    value % BigInt("1000000000000000000");

  if (fraction === BigInt(0)) {
    return whole.toString();
  }

  const fractionText = fraction
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");

  return `${whole.toString()}.${fractionText}`;
}

function genToNumber(value: bigint): number {
  return Number(formatGen(value));
}

function getLocalMetadata(
  onChain: OnChainProlly,
  localProllys: Prolly[],
): Prolly {
  const existing = localProllys.find(
    (item) =>
      item.onChainId ===
      onChain.id.toString(),
  );

  if (existing) {
    return {
      ...existing,
      title:
        existing.title || onChain.name,
      entryAmount: genToNumber(
        onChain.entryFee,
      ),
      maxParticipants: Number(
        onChain.maxParticipants,
      ),
      winners: Number(
        onChain.winnerCount,
      ),
      participants: Number(
        onChain.participantCount,
      ),
    };
  }

  return {
    id: `onchain-${onChain.id.toString()}`,
    onChainId: onChain.id.toString(),
    title: onChain.name,
    description: "",
    creatorUsername: "Admin",
    creatorRole: "admin",
    entryAmount: genToNumber(
      onChain.entryFee,
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

export default function ProllysPage() {
  const {
    address,
    isConnected,
  } = useAccount();

  const {
    connect,
    connectors,
    isPending: isConnecting,
  } = useConnect();

  const [
    mounted,
    setMounted,
  ] = useState(false);

  const [
    prollys,
    setProllys,
  ] = useState<Prolly[]>([]);

  const [
    onChainProllys,
    setOnChainProllys,
  ] = useState<OnChainProlly[]>([]);

  const [
    joinedStates,
    setJoinedStates,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    selectedProlly,
    setSelectedProlly,
  ] = useState<Prolly | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    joining,
    setJoining,
  ] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadData() {
    if (!mounted) {
      return;
    }

    try {
      setLoading(true);

      const onChain =
        await getAllOnChainProllys();

      setOnChainProllys(onChain);

      const local =
        loadProllys();

      const merged =
        onChain.map((item) =>
          getLocalMetadata(
            item,
            local,
          ),
        );

      setProllys(merged);

      saveProllys(merged);

      if (address) {
        const joinedEntries =
          await Promise.all(
            onChain.map(
              async (item) => {
                try {
                  const joined =
                    await hasJoinedProlly(
                      item.id,
                      address,
                    );

                  return [
                    item.id.toString(),
                    joined,
                  ] as const;
                } catch (error) {
                  console.error(
                    `Failed to check join status for Prolly ${item.id.toString()}:`,
                    error,
                  );

                  return [
                    item.id.toString(),
                    false,
                  ] as const;
                }
              },
            ),
          );

        setJoinedStates(
          Object.fromEntries(
            joinedEntries,
          ),
        );
      } else {
        setJoinedStates({});
      }
    } catch (error) {
      console.error(
        "Failed to load Prollys from GenLayer:",
        error,
      );

      alert(
        `Failed to load Prollys from GenLayer: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, address]);

  function handleJoinClick(
    prolly: Prolly,
  ) {
    if (
      isConnecting ||
      joining
    ) {
      return;
    }

    const chain =
      onChainProllys.find(
        (item) =>
          item.id.toString() ===
          prolly.onChainId,
      );

    if (!chain) {
      alert(
        "This Prolly could not be found on GenLayer.",
      );
      return;
    }

    if (chain.closed) {
      alert(
        "This Prolly is closed.",
      );
      return;
    }

    if (
      chain.participantCount >=
      chain.maxParticipants
    ) {
      alert(
        "This Prolly is full.",
      );
      return;
    }

    if (!isConnected) {
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
            setSelectedProlly(
              prolly,
            );
          },
          onError: (error) => {
            console.error(
              "Wallet connection failed:",
              error,
            );

            alert(
              `Wallet connection failed: ${
                error instanceof Error
                  ? error.message
                  : "Unknown error"
              }`,
            );
          },
        },
      );

      return;
    }

    if (
      joinedStates[
        prolly.onChainId ??
          ""
      ]
    ) {
      alert(
        "This wallet has already joined this Prolly.",
      );
      return;
    }

    setSelectedProlly(
      prolly,
    );
  }

  async function handleJoin() {
    if (joining) {
      return;
    }

    if (
      !address ||
      !isConnected
    ) {
      alert(
        "Please connect your wallet first.",
      );
      return;
    }

    if (
      !selectedProlly?.onChainId
    ) {
      alert(
        "This Prolly does not have a valid GenLayer ID.",
      );
      return;
    }

    const chain =
      onChainProllys.find(
        (item) =>
          item.id.toString() ===
          selectedProlly.onChainId,
      );

    if (!chain) {
      alert(
        "This Prolly could not be found on GenLayer.",
      );
      return;
    }

    if (chain.closed) {
      alert(
        "This Prolly is closed.",
      );
      setSelectedProlly(null);
      return;
    }

    if (
      chain.participantCount >=
      chain.maxParticipants
    ) {
      alert(
        "This Prolly is full.",
      );
      setSelectedProlly(null);
      return;
    }

    if (
      joinedStates[
        selectedProlly.onChainId
      ]
    ) {
      alert(
        "This wallet has already joined this Prolly.",
      );
      setSelectedProlly(null);
      return;
    }

    try {
      setJoining(true);

      const payment =
        chain.entryFee;

      alert(
        `Joining with ${formatGen(payment)} GEN. Please confirm the GenLayer transaction in MetaMask.`,
      );

      await joinOnChainProlly(
        address,
        chain.id,
        payment,
      );

      setSelectedProlly(null);

      alert(
        "Successfully joined the Prolly on GenLayer.",
      );

      await loadData();
    } catch (error) {
      console.error(
        "GenLayer join failed:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      alert(
        `Join failed: ${message}`,
      );
    } finally {
      setJoining(false);
    }
  }

  const availableProllys =
    useMemo(
      () =>
        onChainProllys.length,
      [onChainProllys],
    );

  if (!mounted) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <p className="text-zinc-400">
            Loading...
          </p>
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
            href="/admin"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          >
            Create a Prolly
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              Explore
            </p>

            <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
              Choose your Prolly.
            </h1>

            <p className="mt-5 text-lg leading-8 text-zinc-400">
              Pick an active Prolly and join
              immediately. Every participant
              gets one opportunity.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/5 px-5 py-4">
          <p className="text-sm text-green-300">
            {availableProllys} Prolly
            {availableProllys === 1
              ? ""
              : "s"} currently registered
            on GenLayer.
          </p>
        </div>

        {loading ? (
          <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <p className="text-zinc-400">
              Loading Prollys from GenLayer...
            </p>
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {prollys.map(
              (prolly) => {
                const chain =
                  onChainProllys.find(
                    (item) =>
                      item.id.toString() ===
                      prolly.onChainId,
                  );

                if (!chain) {
                  return null;
                }

                const participantCount =
                  Number(
                    chain.participantCount,
                  );

                const maxParticipants =
                  Number(
                    chain.maxParticipants,
                  );

                const isFull =
                  participantCount >=
                  maxParticipants;

                const isClosed =
                  chain.closed;

                const isJoined =
                  !!prolly.onChainId &&
                  !!joinedStates[
                    prolly.onChainId
                  ];

                const progress =
                  maxParticipants > 0
                    ? Math.min(
                        (participantCount /
                          maxParticipants) *
                          100,
                        100,
                      )
                    : 0;

                return (
                  <article
                    key={chain.id.toString()}
                    className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-2xl font-bold">
                          {prolly.title ||
                            chain.name ||
                            "Untitled Prolly"}
                        </h2>

                        <span className="shrink-0 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">
                          #
                          {chain.id.toString()}
                        </span>
                      </div>

                      <p className="mt-3 min-h-14 text-sm leading-6 text-zinc-400">
                        {prolly.description ||
                          "No description provided."}
                      </p>

                      <div className="mt-6 flex h-48 items-center justify-center rounded-2xl bg-zinc-800">
                        <span className="text-sm text-zinc-600">
                          Prolly image
                        </span>
                      </div>

                      <div className="mt-6 space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">
                            Entry fee
                          </span>

                          <span className="font-medium">
                            {formatGen(
                              chain.entryFee,
                            )}{" "}
                            GEN
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-zinc-500">
                            Participants
                          </span>

                          <span className="font-medium">
                            {participantCount} /{" "}
                            {maxParticipants}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-zinc-500">
                            Winners
                          </span>

                          <span className="font-medium">
                            {chain.winnerCount.toString()}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-zinc-500">
                            Status
                          </span>

                          <span
                            className={
                              isClosed
                                ? "font-semibold text-red-400"
                                : "font-semibold text-green-400"
                            }
                          >
                            {isClosed
                              ? "Closed"
                              : "Open"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>

                      <button
                        disabled={
                          isClosed ||
                          isFull ||
                          isJoined ||
                          isConnecting ||
                          joining
                        }
                        onClick={() =>
                          handleJoinClick(
                            prolly,
                          )
                        }
                        className={`mt-7 w-full rounded-full py-3 font-semibold ${
                          isClosed ||
                          isFull ||
                          isJoined ||
                          isConnecting ||
                          joining
                            ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                            : "bg-violet-500 hover:bg-violet-400"
                        }`}
                      >
                        {isClosed
                          ? "Prolly Closed"
                          : isFull
                            ? "Prolly Full"
                            : isJoined
                              ? "Already Joined"
                              : !isConnected
                                ? "Connect wallet to join"
                                : "Join Prolly"}
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}

        {!loading &&
          prollys.length === 0 && (
            <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
              <p className="text-zinc-400">
                No Prollys are available on
                GenLayer yet.
              </p>

              <Link
                href="/admin"
                className="mt-5 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
              >
                Create a Prolly
              </Link>
            </div>
          )}
      </section>

      {selectedProlly &&
        onChainProllys.find(
          (item) =>
            item.id.toString() ===
            selectedProlly.onChainId,
        ) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
            <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
              {(() => {
                const selectedChain =
                  onChainProllys.find(
                    (item) =>
                      item.id.toString() ===
                      selectedProlly.onChainId,
                  );

                if (!selectedChain) {
                  return null;
                }

                return (
                  <>
                    <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
                      Join Prolly
                    </p>

                    <h2 className="mt-3 text-3xl font-bold">
                      {selectedProlly.title ||
                        selectedChain.name ||
                        "Untitled Prolly"}
                    </h2>

                    <p className="mt-4 text-sm leading-6 text-zinc-400">
                      {selectedProlly.description ||
                        "No description provided."}
                    </p>

                    <div className="mt-7 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">
                          Entry fee
                        </span>

                        <span>
                          {formatGen(
                            selectedChain.entryFee,
                          )}{" "}
                          GEN
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-zinc-500">
                          Participants
                        </span>

                        <span>
                          {selectedChain.participantCount.toString()}{" "}
                          /{" "}
                          {selectedChain.maxParticipants.toString()}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-zinc-500">
                          Winners
                        </span>

                        <span>
                          {selectedChain.winnerCount.toString()}
                        </span>
                      </div>
                    </div>

                    <p className="mt-5 text-sm leading-6 text-zinc-500">
                      Your wallet will submit the
                      GenLayer transaction. The
                      contract requires the exact
                      entry fee.
                    </p>

                    <button
                      onClick={handleJoin}
                      disabled={
                        joining ||
                        !isConnected
                      }
                      className="mt-7 w-full rounded-full bg-violet-500 py-3 font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {joining
                        ? "Joining on GenLayer..."
                        : "Confirm & Join"}
                    </button>

                    <button
                      onClick={() =>
                        setSelectedProlly(null)
                      }
                      disabled={joining}
                      className="mt-3 w-full rounded-full border border-zinc-800 py-3 font-semibold hover:bg-zinc-900 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        )}
    </main>
  );
}
