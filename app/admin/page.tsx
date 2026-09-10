"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";

import {
  loadProllys,
  saveProllys,
  type Prolly,
} from "@/lib/prolly-store";

import { loadProfile } from "@/lib/profile-store";

import {
  createProlly,
  getAllOnChainProllys,
  closeProlly as closeOnChainProlly,
  type OnChainProlly,
} from "@/lib/genlayer";

import {
  getRole,
  loadSponsorApplications,
  updateSponsorApplicationStatus,
  type SponsorApplication,
} from "@/lib/role-store";

const ADMIN_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS;

type ProllyStatus = "active" | "closed";

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

function getLocalMetadata(
  onChain: OnChainProlly,
  localProllys: Prolly[],
): Prolly {
  const existing = localProllys.find(
    (item) =>
      item.onChainId === onChain.id.toString(),
  );

  if (existing) {
    return {
      ...existing,
      title:
        existing.title || onChain.name,
      entryAmount: Number(
        formatGen(onChain.entryFee),
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
    entryAmount: Number(
      formatGen(onChain.entryFee),
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

export default function AdminPage() {
  const { address, isConnected } = useAccount();

  const [mounted, setMounted] =
    useState(false);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [prollys, setProllys] =
    useState<Prolly[]>([]);

  const [onChainProllys, setOnChainProllys] =
    useState<OnChainProlly[]>([]);

  const [loadingProllys, setLoadingProllys] =
    useState(true);

  const [showCreate, setShowCreate] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [closingId, setClosingId] =
    useState<string | null>(null);

  const [sponsorApplications, setSponsorApplications] =
    useState<SponsorApplication[]>([]);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [entryFee, setEntryFee] =
    useState("1");

  const [maxParticipants, setMaxParticipants] =
    useState("100");

  const [winners, setWinners] =
    useState("10");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) {
      setIsAdmin(false);
      return;
    }

    setIsAdmin(
      getRole(
        address,
        ADMIN_ADDRESS,
      ) === "admin",
    );
  }, [address]);

  useEffect(() => {
    if (!mounted || !isAdmin) {
      return;
    }

    setSponsorApplications(
      loadSponsorApplications(),
    );
  }, [mounted, isAdmin]);

  async function loadOnChainData() {
    if (!mounted || !isAdmin) {
      return;
    }

    try {
      setLoadingProllys(true);

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

      saveProllys(
        merged.map((item) => ({
          ...item,
        })),
      );
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
      setLoadingProllys(false);
    }
  }

  useEffect(() => {
    loadOnChainData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isAdmin]);

  const stats = useMemo(() => {
    const active =
      onChainProllys.filter(
        (item) => !item.closed,
      ).length;

    const closed =
      onChainProllys.filter(
        (item) => item.closed,
      ).length;

    const totalParticipants =
      onChainProllys.reduce(
        (sum, item) =>
          sum +
          Number(
            item.participantCount,
          ),
        0,
      );

    return {
      total: onChainProllys.length,
      active,
      closed,
      totalParticipants,
    };
  }, [onChainProllys]);

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

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
            <h1 className="text-2xl font-bold">
              Admin access required
            </h1>

            <p className="mt-3 text-zinc-400">
              Connect your admin wallet to continue.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <h1 className="text-2xl font-bold">
              Access denied
            </h1>

            <p className="mt-3 text-zinc-400">
              This wallet does not have administrator privileges.
            </p>
          </div>
        </div>
      </main>
    );
  }

  async function handleCreate() {
    if (creating) {
      return;
    }

    const fee = Number(entryFee);
    const max = Number(maxParticipants);
    const winnerCount = Number(winners);

    if (!name.trim()) {
      alert("Prolly name is required.");
      return;
    }

    if (!Number.isFinite(fee) || fee <= 0) {
      alert(
        "Entry fee must be greater than zero.",
      );
      return;
    }

    if (!Number.isInteger(max) || max <= 0) {
      alert(
        "Maximum participants must be a positive whole number.",
      );
      return;
    }

    if (
      !Number.isInteger(winnerCount) ||
      winnerCount <= 0
    ) {
      alert(
        "Number of winners must be a positive whole number.",
      );
      return;
    }

    if (winnerCount > max) {
      alert(
        "Number of winners cannot exceed maximum participants.",
      );
      return;
    }

    if (!address) {
      alert(
        "Connect your wallet to create a Prolly.",
      );
      return;
    }

    try {
      setCreating(true);

      const adminProfile =
        loadProfile(address);

      const creatorUsername =
        adminProfile?.username ??
        `${address.slice(
          0,
          6,
        )}...${address.slice(-4)}`;

      const entryFeeOnChain =
        BigInt(
          Math.round(
            fee *
              1_000_000_000_000_000_000,
          ),
        );

      alert(
        "Creating Prolly on GenLayer. Please confirm the wallet transaction.",
      );

      const result =
        await createProlly(
          address,
          name.trim(),
          entryFeeOnChain,
          BigInt(max),
          BigInt(winnerCount),
        );

      const newProlly: Prolly = {
        id: `onchain-${result.prollyId.toString()}`,
        onChainId:
          result.prollyId.toString(),
        title: name.trim(),
        description:
          description.trim(),
        creatorUsername,
        creatorRole: "admin",
        entryAmount: fee,
        participants: 0,
        maxParticipants: max,
        winners: winnerCount,
        closingMode: "participants",
        createdAt: Date.now(),
      };

      const existingLocal =
        loadProllys();

      const updatedLocal = [
        ...existingLocal.filter(
          (item) =>
            item.onChainId !==
            newProlly.onChainId,
        ),
        newProlly,
      ];

      saveProllys(updatedLocal);

      setName("");
      setDescription("");
      setEntryFee("1");
      setMaxParticipants("100");
      setWinners("10");
      setShowCreate(false);

      alert(
        `Prolly created successfully on GenLayer. On-chain ID: ${result.prollyId.toString()}`,
      );

      await loadOnChainData();
    } catch (error) {
      console.error(
        "GenLayer Prolly creation failed:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      alert(
        `Failed to create Prolly on GenLayer: ${message}`,
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleClose(
    prolly: Prolly,
  ) {
    if (closingId) {
      return;
    }

    if (!prolly.onChainId) {
      alert(
        "This Prolly does not have an on-chain ID.",
      );
      return;
    }

    if (
      !confirm(
        `Close "${prolly.title || "Untitled Prolly"}" on GenLayer?`,
      )
    ) {
      return;
    }

    if (!address) {
      alert(
        "Connect your admin wallet first.",
      );
      return;
    }

    try {
      setClosingId(
        prolly.onChainId,
      );

      alert(
        "Closing Prolly on GenLayer. Please confirm the wallet transaction.",
      );

      await closeOnChainProlly(
        address,
        BigInt(
          prolly.onChainId,
        ),
      );

      alert(
        "Prolly closed successfully on GenLayer.",
      );

      await loadOnChainData();
    } catch (error) {
      console.error(
        "Failed to close Prolly:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      alert(
        `Failed to close Prolly: ${message}`,
      );
    } finally {
      setClosingId(null);
    }
  }

  function handleSponsorDecision(
    walletAddress: string,
    status:
      | "approved"
      | "rejected",
  ) {
    updateSponsorApplicationStatus(
      walletAddress,
      status,
    );

    setSponsorApplications(
      loadSponsorApplications(),
    );
  }

  function getOnChainRecord(
    prolly: Prolly,
  ) {
    return onChainProllys.find(
      (item) =>
        item.id.toString() ===
        prolly.onChainId,
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

          <div className="flex items-center gap-3">
            <Link
              href="/prollys"
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
            >
              Explore
            </Link>

            <button
              onClick={() =>
                setShowCreate(true)
              }
              className="rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold hover:bg-violet-400"
            >
              + Create Prolly
            </button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Admin Dashboard
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Manage your Prollys.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
            Prolly state is read directly from
            GenLayer. Local storage is used only
            for supplementary metadata.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">
              Total Prollys
            </p>

            <p className="mt-2 text-3xl font-bold">
              {stats.total}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">
              Active
            </p>

            <p className="mt-2 text-3xl font-bold text-green-400">
              {stats.active}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">
              Closed
            </p>

            <p className="mt-2 text-3xl font-bold">
              {stats.closed}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">
              Participants
            </p>

            <p className="mt-2 text-3xl font-bold">
              {stats.totalParticipants}
            </p>
          </div>
        </div>

        <div className="mt-12 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  Sponsor Applications
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Approve users who qualify to become Prolly sponsors.
                </p>
              </div>

              <span className="rounded-full bg-violet-500/10 px-3 py-1 text-sm font-semibold text-violet-400">
                {
                  sponsorApplications.filter(
                    (application) =>
                      application.status ===
                      "pending",
                  ).length
                }{" "}
                pending
              </span>
            </div>
          </div>

          {sponsorApplications.length ===
          0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-zinc-500">
                No sponsor applications yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {sponsorApplications.map(
                (application) => (
                  <div
                    key={
                      application.walletAddress
                    }
                    className="p-6"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold">
                            {application.name}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              application.status ===
                              "pending"
                                ? "bg-yellow-500/10 text-yellow-400"
                                : application.status ===
                                    "approved"
                                  ? "bg-green-500/10 text-green-400"
                                  : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {
                              application.status
                            }
                          </span>
                        </div>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                          {
                            application.description
                          }
                        </p>

                        {application.website && (
                          <p className="mt-2 text-sm text-violet-400">
                            {
                              application.website
                            }
                          </p>
                        )}

                        <p className="mt-3 break-all text-xs text-zinc-600">
                          Wallet:{" "}
                          {
                            application.walletAddress
                          }
                        </p>

                        <p className="mt-1 text-xs text-zinc-600">
                          Applied:{" "}
                          {new Date(
                            application.createdAt,
                          ).toLocaleString()}
                        </p>
                      </div>

                      {application.status ===
                        "pending" && (
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() =>
                              handleSponsorDecision(
                                application.walletAddress,
                                "approved",
                              )
                            }
                            className="rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-black hover:bg-green-400"
                          >
                            Approve Sponsor
                          </button>

                          <button
                            onClick={() =>
                              handleSponsorDecision(
                                application.walletAddress,
                                "rejected",
                              )
                            }
                            className="rounded-full border border-red-500/30 px-5 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        <div className="mt-12 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
            <div>
              <h2 className="text-xl font-bold">
                Your Prollys
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Live state from GenLayer
              </p>
            </div>

            <button
              onClick={loadOnChainData}
              disabled={loadingProllys}
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingProllys
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          {loadingProllys ? (
            <div className="px-6 py-16 text-center">
              <p className="text-zinc-400">
                Loading Prollys from GenLayer...
              </p>
            </div>
          ) : prollys.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-zinc-400">
                No Prollys exist on GenLayer yet.
              </p>

              <button
                onClick={() =>
                  setShowCreate(true)
                }
                className="mt-5 rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
              >
                Create your first Prolly
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {prollys.map((prolly) => {
                const chain =
                  getOnChainRecord(prolly);

                if (!chain) {
                  return null;
                }

                const participantCount =
                  Number(
                    chain.participantCount,
                  );

                const max =
                  Number(
                    chain.maxParticipants,
                  );

                const progress =
                  max > 0
                    ? Math.min(
                        (participantCount /
                          max) *
                          100,
                        100,
                      )
                    : 0;

                const status: ProllyStatus =
                  chain.closed
                    ? "closed"
                    : "active";

                return (
                  <div
                    key={chain.id.toString()}
                    className="p-6 transition hover:bg-zinc-900/70"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold">
                            {prolly.title ||
                              chain.name ||
                              "Untitled Prolly"}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              status ===
                              "active"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {status}
                          </span>

                          <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400">
                            On-chain #
                            {chain.id.toString()}
                          </span>
                        </div>

                        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                          {prolly.description ||
                            "No description provided."}
                        </p>

                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
                          <span>
                            Participants:{" "}
                            <strong className="text-zinc-300">
                              {participantCount}/
                              {max}
                            </strong>
                          </span>

                          <span>
                            Entry:{" "}
                            <strong className="text-zinc-300">
                              {formatGen(
                                chain.entryFee,
                              )}{" "}
                              GEN
                            </strong>
                          </span>

                          <span>
                            Winners:{" "}
                            <strong className="text-zinc-300">
                              {
                                chain.winnerCount
                              }
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/prollys/${chain.id.toString()}`}
                          className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-800"
                        >
                          View
                        </Link>

                        {status ===
                          "active" && (
                          <button
                            onClick={() =>
                              handleClose(
                                prolly,
                              )
                            }
                            disabled={
                              closingId ===
                              chain.id.toString()
                            }
                            className="rounded-full border border-yellow-500/30 px-4 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {closingId ===
                            chain.id.toString()
                              ? "Closing..."
                              : "Close"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
          <p className="font-semibold text-green-300">
            GenLayer source of truth
          </p>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Prolly participant counts, entry fees,
            winner counts, closed status, and winner
            finalization state are read from the
            GenLayer contract. Browser storage is
            only used for supplementary metadata such
            as descriptions and creator display names.
          </p>
        </div>
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-6">
          <div className="mx-auto my-10 w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
                  New Prolly
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  Create a Prolly
                </h2>
              </div>

              <button
                onClick={() =>
                  setShowCreate(false)
                }
                disabled={creating}
                className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-400 hover:bg-zinc-900 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <label className="text-sm font-medium text-zinc-300">
                  Title
                </label>

                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="e.g. Friday Jackpot"
                  disabled={creating}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value,
                    )
                  }
                  placeholder="Tell participants what this Prolly is about..."
                  rows={4}
                  disabled={creating}
                  className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500 disabled:opacity-50"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Entry fee (GEN)
                  </label>

                  <input
                    type="number"
                    min="0.000000000000000001"
                    step="0.01"
                    value={entryFee}
                    onChange={(e) =>
                      setEntryFee(
                        e.target.value,
                      )
                    }
                    disabled={creating}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Maximum participants
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={maxParticipants}
                    onChange={(e) =>
                      setMaxParticipants(
                        e.target.value,
                      )
                    }
                    disabled={creating}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Number of winners
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={winners}
                    onChange={(e) =>
                      setWinners(
                        e.target.value,
                      )
                    }
                    disabled={creating}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="text-sm font-semibold text-violet-300">
                  GenLayer deployment
                </p>

                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Creating this Prolly submits the
                  configuration directly to the
                  GenLayer contract. The contract is
                  the source of truth for participants,
                  entry fees, closing, and winner
                  selection.
                </p>
              </div>

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full rounded-full bg-violet-500 py-4 font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating
                  ? "Creating on GenLayer..."
                  : "Create Prolly"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
