"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import {
  loadSponsorCampaigns,
  saveSponsorCampaigns,
  removeSponsorCampaign,
  type SponsorCampaign,
} from "@/lib/sponsor-store";
import { useEffect, useState } from "react";
import { getRole } from "@/lib/role-store";
import { PROLLY_CONTRACT_OWNER } from "@/lib/genlayer";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";

type CampaignType = "manual" | "task" | "generated-link";

type Campaign = {
  id: string;
  ownerWallet: string;
  title: string;
  type: CampaignType;
  description: string;
  instructions: string;
  reference: string;
  createdAt: number;
  accessCode?: string;
  entryFee?: string;
  maxParticipants?: string;
  winnerCount?: string;
};


export default function SponsorDashboard() {
  const { address } = useAccount();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [type, setType] = useState<CampaignType>("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [entryFee, setEntryFee] = useState("1");
  const [maxParticipants, setMaxParticipants] = useState("100");
  const [winnerCount, setWinnerCount] = useState("10");

  function makeAccessCode() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    }

    return Date.now().toString(36).slice(-8).toUpperCase();
  }

  const approved =
    !!address && (() => {
      const role = getRole(address, PROLLY_CONTRACT_OWNER);
      return role === "sponsor" || role === "admin";
    })();

  useEffect(() => {
    if (!address) {
      setCampaigns([]);
      return;
    }
    setCampaigns(loadSponsorCampaigns(address) as Campaign[]);
  }, [address]);

  function deleteCampaign(campaignId: string) {
    if (!address) return;
    removeSponsorCampaign(address, campaignId);
    setCampaigns((current) => current.filter((campaign) => campaign.id !== campaignId));
    setMessage("Campaign brief deleted from this browser.");
  }

  function createCampaign() {
    if (!title.trim() || !description.trim()) {
      setMessage("Title and description are required.");
      return;
    }

    const fee = Number(entryFee);
    const max = Number(maxParticipants);
    const winners = Number(winnerCount);

    if (!Number.isFinite(fee) || fee <= 0 || !Number.isInteger(max) || max <= 0 || !Number.isInteger(winners) || winners <= 0 || winners > max) {
      setMessage("Enter valid economics: fee > 0, positive participant count, and winners cannot exceed participants.");
      return;
    }

    if (!address) {
      setMessage("Connect your sponsor wallet first.");
      return;
    }

    const campaign: Campaign = {
      id: `sponsor-${Date.now()}`,
      ownerWallet: address,
      title: title.trim(),
      type,
      description: description.trim(),
      instructions: instructions.trim(),
      reference: reference.trim(),
      createdAt: Date.now(),
      accessCode: type === "generated-link" ? makeAccessCode() : undefined,
      entryFee: entryFee,
      maxParticipants: maxParticipants,
      winnerCount: winnerCount,
    };

    const next = [campaign, ...campaigns];
    saveSponsorCampaigns(address, next as SponsorCampaign[]);
    setCampaigns(next);
    setTitle("");
    setDescription("");
    setInstructions("");
    setReference("");
    setEntryFee("1");
    setMaxParticipants("100");
    setWinnerCount("10");
    setMessage(
      "Campaign brief saved. On-chain Prolly creation remains owner-controlled by the current GenLayer contract.",
    );
  }

  if (!approved) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        <div className="mx-auto max-w-2xl pt-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Sponsor Dashboard
          </p>
          <h1 className="mt-4 text-3xl font-bold">Sponsor access required</h1>
          <p className="mt-4 text-zinc-400">
            Only an approved sponsor wallet can manage sponsor campaign
            briefs.
          </p>
          <Link
            href="/sponsor"
            className="mt-6 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold"
          >
            Sponsor Application
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
          <div className="flex items-center gap-3">
            <WorkspaceSwitcher />
            <Link
              href="/prollys"
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-800"
            >
              Explore
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Sponsor Dashboard
        </p>
        <h1 className="mt-4 text-4xl font-bold">Build your campaign brief.</h1>
        <p className="mt-4 max-w-3xl text-zinc-400">
          Prepare a sponsor campaign brief using one of the three supported post
          formats. This workspace is planning-only until sponsor creation is
          supported by the deployed GenLayer contract. It never decides winners.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7">
            <h2 className="text-2xl font-semibold">Create campaign brief</h2>

            <label className="mt-6 block text-sm font-medium text-zinc-300">
              Post type
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {([
                ["manual", "Manual"],
                ["task", "Task"],
                ["generated-link", "Preview Link"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setType(value)}
                  className={`rounded-2xl border px-4 py-4 text-left ${
                    type === value
                      ? "border-violet-500 bg-violet-500/10 text-violet-300"
                      : "border-zinc-700 hover:bg-zinc-800"
                  }`}
                >
                  <p className="font-semibold">{label}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {value === "manual"
                      ? "Manual participant names"
                      : value === "task"
                        ? "One task per post"
                        : "Browser-local preview"}
                  </p>
                </button>
              ))}
            </div>

            <label className="mt-6 block text-sm font-medium text-zinc-300">
              Campaign title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Creator Challenge"
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
            />

            <label className="mt-6 block text-sm font-medium text-zinc-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Explain the campaign."
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
            />

            <label className="mt-6 block text-sm font-medium text-zinc-300">
              Rules / task instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              placeholder={
                type === "task"
                  ? "Describe exactly what participants must submit."
                  : "Optional rules or participation notes."
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
            />

            <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
              <p className="text-sm font-semibold text-cyan-300">Sponsor economics</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Planning values only. They are saved with this campaign brief and are not sent to the deployed GenLayer contract.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-zinc-400">Entry fee (GEN)</label>
                  <input type="number" min="0.000000000000000001" step="0.01" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Max participants</label>
                  <input type="number" min="1" step="1" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Winners</label>
                  <input type="number" min="1" step="1" value={winnerCount} onChange={(e) => setWinnerCount(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-400">Maximum pool: <span className="font-semibold text-zinc-200">{(Number(entryFee) * Number(maxParticipants)).toLocaleString()} GEN</span></div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-400">Full-capacity chance: <span className="font-semibold text-zinc-200">{Number(maxParticipants) > 0 ? ((Number(winnerCount) / Number(maxParticipants)) * 100).toFixed(2) : "0.00"}%</span></div>
              </div>
            </div>

            <label className="mt-6 block text-sm font-medium text-zinc-300">
              Reference / example / link
            </label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional image URL, example, link, or access code"
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
            />

            <button
              onClick={createCampaign}
              className="mt-7 w-full rounded-full bg-violet-500 py-3 font-semibold hover:bg-violet-400"
            >
              Save Campaign Brief
            </button>

            {message && (
              <p className="mt-4 text-center text-sm text-zinc-400">{message}</p>
            )}
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7">
            <h2 className="text-2xl font-semibold">My campaigns</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Saved sponsor briefs for this browser. Economics shown here are planning values until an on-chain sponsor creation flow is introduced.
            </p>

            {campaigns.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-500">
                No campaign briefs yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {campaigns.map((campaign) => (
                  <article
                    key={campaign.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-violet-400">
                          {campaign.type === "generated-link"
                            ? "Preview Link"
                            : campaign.type}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold">
                          {campaign.title}
                        </h3>
                      </div>
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1 text-xs text-amber-300">
                        Brief
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      {campaign.description}
                    </p>
                    <div className="mt-4 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                      <span>Entry: <strong className="text-zinc-300">{campaign.entryFee ?? "—"} GEN</strong></span>
                      <span>Max pool: <strong className="text-zinc-300">{campaign.entryFee && campaign.maxParticipants ? (Number(campaign.entryFee) * Number(campaign.maxParticipants)).toLocaleString() : "—"} GEN</strong></span>
                      <span>Winners: <strong className="text-zinc-300">{campaign.winnerCount ?? "—"}</strong></span>
                    </div>
                    {campaign.type === "generated-link" && campaign.accessCode && (
                      <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                        <p className="text-xs uppercase tracking-widest text-cyan-300">Preview link</p>
                        <p className="mt-2 break-all text-sm text-cyan-200">
                          {typeof window !== "undefined"
                            ? window.location.origin + "/sponsor/campaign/" + campaign.accessCode
                            : "/sponsor/campaign/" + campaign.accessCode}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-zinc-500">Browser-local preview only. It does not create a public campaign, participant, or on-chain Prolly.</p>
                        <button
                          onClick={() => {
                            const link = window.location.origin + "/sponsor/campaign/" + campaign.accessCode;
                            void navigator.clipboard?.writeText(link);
                            setMessage("Preview link copied.");
                          }}
                          className="mt-3 rounded-full border border-cyan-500/30 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10"
                        >
                          Copy preview link
                        </button>
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => deleteCampaign(campaign.id)}
                        className="rounded-full border border-red-500/20 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                      >
                        Delete brief
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
