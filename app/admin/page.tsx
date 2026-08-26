"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import {
  defaultProllys,
  loadProllys,
  saveProllys,
  type Prolly,
} from "@/lib/prolly-store";

import {
 getRole,
  loadSponsorApplications,
  updateSponsorApplicationStatus,
  type SponsorApplication,
} from "@/lib/role-store";
const ADMIN_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS;

type ProllyStatus = "active" | "closed" | "cancelled";

function getStatus(prolly: Prolly): ProllyStatus {
  const statuses = localStorage.getItem("prolly-statuses");

  if (statuses) {
    try {
      const parsed = JSON.parse(statuses) as Record<string, ProllyStatus>;

      if (parsed[prolly.id]) {
        return parsed[prolly.id];
      }
    } catch {}
  }

  if (prolly.participants >= prolly.maxParticipants) {
    return "closed";
  }

  return "active";
}

function saveStatus(id: string, status: ProllyStatus) {
  const saved = localStorage.getItem("prolly-statuses");

  let statuses: Record<string, ProllyStatus> = {};

  if (saved) {
    try {
      statuses = JSON.parse(saved);
    } catch {}
  }

  statuses[id] = status;
  localStorage.setItem("prolly-statuses", JSON.stringify(statuses));
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();

  const [prollys, setProllys] = useState<Prolly[]>([]);
const [isAdmin, setIsAdmin] = useState(false);
const [mounted, setMounted] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ProllyStatus>>({});
  const [showCreate, setShowCreate] = useState
(false);
const [sponsorApplications, setSponsorApplications] = useState<
  SponsorApplication[]
>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState("1");
  const [maxParticipants, setMaxParticipants] = useState("100");
  const [winners, setWinners] = useState("10");
  const [closingMode, setClosingMode] = useState<
    "participants" | "time" | "either"
  >("participants");
  const [duration, setDuration] = useState("60");

  useEffect(() => {
  setMounted(true);

  setIsAdmin(getRole(address, ADMIN_ADDRESS) === "admin");

  const stored = loadProllys();

    if (stored.length === 0) {
      saveProllys(defaultProllys);
      setProllys(defaultProllys);
    } else {
      setProllys(stored);
    }

    const statusMap: Record<string, ProllyStatus> = {};

    stored.forEach((prolly) => {
      statusMap[prolly.id] = getStatus(prolly);
    });

    setStatuses(statusMap);
    setSponsorApplications(loadSponsorApplications());
  }, [address]);

const stats = useMemo(() => {
  const active = prollys.filter(
    (p) => (statuses[p.id] || "active") === "active",
  ).length;

  const closed = prollys.filter(
    (p) => (statuses[p.id] || "active") === "closed",
  ).length;

  const totalParticipants = prollys.reduce(
    (sum, p) => sum + p.participants,
    0,
  );

  const totalPool = prollys.reduce(
    (sum, p) => sum + p.entryAmount * p.participants,
    0,
  );

  return {
    total: prollys.length,
    active,
    closed,
    totalParticipants,
    totalPool,
  };
}, [prollys, statuses]);

if (!mounted) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
        <p className="text-zinc-400">Loading...</p>
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

  function handleCreate() {
    const fee = Number(entryFee);
    const max = Number(maxParticipants);
    const winnerCount = Number(winners);

    if (fee <= 0) {
      alert("Entry fee must be greater than zero.");
      return;
    }

    if (max <= 0) {
      alert("Maximum participants must be greater than zero.");
      return;
    }

    if (winnerCount <= 0) {
      alert("Number of winners must be greater than zero.");
      return;
    }

    if (winnerCount > max) {
      alert("Number of winners cannot exceed maximum participants.");
      return;
    }

    const newProlly: Prolly = {
  id: `${Date.now()}-${name.toLowerCase().replace(/\s+/g, "-") || "prolly"}`,
  title: name.trim(),
  description: description.trim(),

  creatorUsername: "boma",
creatorRole: "admin",

  entryAmount: fee,
      participants: 0,
      maxParticipants: max,
      winners: winnerCount,
      closingMode,
      durationMinutes:
        closingMode === "participants" ? undefined : Number(duration) || 60,
      createdAt: Date.now(),
      closesAt:

        closingMode === "participants"
          ? undefined
          : Date.now() + (Number(duration) || 60) * 60 * 1000,
    };

    const updated = [...prollys, newProlly];

    saveProllys(updated);
    saveStatus(newProlly.id, "active");

    setProllys(updated);
    setStatuses((current) => ({
      ...current,
      [newProlly.id]: "active",
    }));

    setName("");
    setDescription("");
    setEntryFee("1");
    setMaxParticipants("100");
    setWinners("10");
    setClosingMode("participants");
    setDuration("60");
    setShowCreate(false);
  }

  function closeProlly(prolly: Prolly) {
    if (!confirm(`Close "${prolly.title || "Untitled Prolly"}"?`)) {
      return;
    }

    saveStatus(prolly.id, "closed");

    setStatuses((current) => ({
      ...current,
      [prolly.id]: "closed",
    }));
  }
function approveSponsor(application: SponsorApplication) {
  updateSponsorApplicationStatus(
    application.walletAddress,
    "approved",
  );

  setSponsorApplications((current) =>
    current.map((item) =>
      item.walletAddress.toLowerCase() ===
      application.walletAddress.toLowerCase()
        ? { ...item, status: "approved" }
        : item,
    ),
  );
}

function rejectSponsor(application: SponsorApplication) {
  updateSponsorApplicationStatus(
    application.walletAddress,
    "rejected",
  );

  setSponsorApplications((current) =>
    current.map((item) =>
      item.walletAddress.toLowerCase() ===
      application.walletAddress.toLowerCase()
        ? { ...item, status: "rejected" }
        : item,
    ),
  );
}
    
function handleSponsorDecision(
  walletAddress: string,
  status: "approved" | "rejected",
) {
  updateSponsorApplicationStatus(walletAddress, status);
  setSponsorApplications(loadSponsorApplications());
}

function deleteProlly(prolly: Prolly) {
  if (
    !confirm(
      `Delete "${prolly.title || "Untitled Prolly"}"? This cannot be undone.`,
    )
  ) {
    return;
  }

  const updated = prollys.filter((item) => item.id !== prolly.id);

  saveProllys(updated);
  localStorage.removeItem(`prolly-participants-${prolly.id}`);

  setProllys(updated);

  setStatuses((current) => {
    const copy = { ...current };
    delete copy[prolly.id];
    return copy;
  });

  const savedStatuses = localStorage.getItem("prolly-statuses");

  if (savedStatuses) {
    try {
      const parsed = JSON.parse(savedStatuses);
      delete parsed[prolly.id];
      localStorage.setItem("prolly-statuses", JSON.stringify(parsed));
    } catch {}
  }
}
      
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <a href="/" className="text-2xl font-bold tracking-tight">
            PROLLY<span className="text-violet-400">.</span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/prollys"
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
            >
              Explore
            </a>

            <button
              onClick={() => setShowCreate(true)}
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
            Create, monitor, and manage your Prollys from one place.
          </p>
        </div>

        {/* STATS */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Total Prollys</p>
            <p className="mt-2 text-3xl font-bold">{stats.total}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Active</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {stats.active}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Closed</p>
            <p className="mt-2 text-3xl font-bold">{stats.closed}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Participants</p>
            <p className="mt-2 text-3xl font-bold">
              {stats.totalParticipants}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-sm text-zinc-500">Total Pool</p>
            <p className="mt-2 text-3xl font-bold text-violet-400">
              ${stats.totalPool}
            </p>
          </div>
        </div>
     
 {/* SPONSOR APPLICATIONS */}
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
            (application) => application.status === "pending",
          ).length
        }{" "}
        pending
      </span>
    </div>
  </div>

  {sponsorApplications.length === 0 ? (
    <div className="px-6 py-12 text-center">
      <p className="text-zinc-500">
        No sponsor applications yet.
      </p>
    </div>
  ) : (
    <div className="divide-y divide-zinc-800">
      {sponsorApplications.map((application) => (
        <div
          key={application.walletAddress}
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
                    application.status === "pending"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : application.status === "approved"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {application.status}
                </span>
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                {application.description}
              </p>

              {application.website && (
                <p className="mt-2 text-sm text-violet-400">
                  {application.website}
                </p>
              )}

              <p className="mt-3 break-all text-xs text-zinc-600">
                Wallet: {application.walletAddress}
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Applied:{" "}
                {new Date(
                  application.createdAt,
                ).toLocaleString()}
              </p>
            </div>

            {application.status === "pending" && (
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
      ))}
    </div>
  )}
</div>


       {/* PROLLY TABLE */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40">
          <div className="border-b border-zinc-800 px-6 py-5">
            <h2 className="text-xl font-bold">Your Prollys</h2>
          </div>

          {prollys.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-zinc-400">You have not created any Prollys.</p>

              <button
                onClick={() => setShowCreate(true)}
                className="mt-5 rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
              >
                Create your first Prolly
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {prollys.map((prolly) => {
                const status = statuses[prolly.id] || "active";
                const pool = prolly.entryAmount * prolly.participants;
                const progress =
                  (prolly.participants / prolly.maxParticipants) * 100;

                return (
                  <div
                    key={prolly.id}
                    className="p-6 transition hover:bg-zinc-900/70"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold">
                            {prolly.title || "Untitled Prolly"}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              status === "active"
                                ? "bg-green-500/10 text-green-400"
                                : status === "closed"
                                  ? "bg-zinc-800 text-zinc-400"
                                  : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                          {prolly.description || "No description provided."}
                        </p>

                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{
                              width: `${Math.min(progress, 100)}%`,
                            }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
                          <span>
                            Participants:{" "}
                            <strong className="text-zinc-300">
                              {prolly.participants}/{prolly.maxParticipants}
                            </strong>
                          </span>

                          <span>
                            Entry:{" "}
                            <strong className="text-zinc-300">
                              ${prolly.entryAmount}
                            </strong>
                          </span>

                          <span>
                            Pool:{" "}
                            <strong className="text-violet-400">
                              ${pool}
                            </strong>
                          </span>

                          <span>
                            Winners:{" "}
                            <strong className="text-zinc-300">
                              {prolly.winners}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href="/prollys"
                          className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-800"
                        >
                          View
                        </a>

                        {status === "active" && (
                          <button
                            onClick={() => closeProlly(prolly)}
                            className="rounded-full border border-yellow-500/30 px-4 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-500/10"
                          >
                            Close
                          </button>
                        )}

                        <button
                          onClick={() => deleteProlly(prolly)}
                          className="rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
          <p className="font-semibold text-violet-300">Prototype notice</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Admin data is currently stored in this browser only. Closing,
            reopening, and deleting Prollys are prototype actions. No real
            blockchain transaction or payment occurs yet.
          </p>
        </div>
      </section>

      {/* CREATE MODAL */}
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
                onClick={() => setShowCreate(false)}
                className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-400 hover:bg-zinc-900"
              >
                ✕
              </button>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <label className="text-sm font-medium text-zinc-300">
                  Title <span className="text-zinc-600">(optional)</span>
                </label>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Friday Jackpot"
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-300">
                  Description{" "}
                  <span className="text-zinc-600">(optional)</span>
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell participants what this Prolly is about..."
                  rows={4}
                  className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Entry fee
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={entryFee}
                    onChange={(e) => setEntryFee(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Maximum participants
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Number of winners
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={winners}
                    onChange={(e) => setWinners(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Closing condition
                  </label>

                  <select
                    value={closingMode}
                    onChange={(e) =>
                      setClosingMode(
                        e.target.value as
                          | "participants"
                          | "time"
                          | "either",
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  >
                    <option value="participants">
                      Maximum participants
                    </option>
                    <option value="time">Time limit</option>
                    <option value="either">Either condition</option>
                  </select>
                </div>
              </div>

              {(closingMode === "time" || closingMode === "either") && (
                <div>
                  <label className="text-sm font-medium text-zinc-300">
                    Duration (minutes)
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-violet-500"
                  />
                </div>
              )}

              <button
                onClick={handleCreate}
                className="w-full rounded-full bg-violet-500 py-4 font-semibold hover:bg-violet-400"
              >
                Create Prolly
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
