"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { getRole } from "@/lib/role-store";
import { PROLLY_CONTRACT_OWNER } from "@/lib/genlayer";

type CampaignType = "manual" | "task" | "generated-link";

type Campaign = {
  id: string;
  title: string;
  type: CampaignType;
  description: string;
  instructions: string;
  reference: string;
  createdAt: number;
};

const STORAGE_KEY = "prolly-sponsor-campaigns";

function loadCampaigns(): Campaign[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Campaign[]) : [];
  } catch {
    return [];
  }
}

export default function SponsorDashboard() {
  const { address } = useAccount();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [type, setType] = useState<CampaignType>("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");

  const approved =
    !!address && getRole(address, PROLLY_CONTRACT_OWNER) === "sponsor";

  useEffect(() => {
    setCampaigns(loadCampaigns());
  }, []);

  function createCampaign() {
    if (!title.trim() || !description.trim()) {
      setMessage("Title and description are required.");
      return;
    }

    const campaign: Campaign = {
      id: `sponsor-${Date.now()}`,
      title: title.trim(),
      type,
      description: description.trim(),
      instructions: instructions.trim(),
      reference: reference.trim(),
      createdAt: Date.now(),
    };

    const next = [campaign, ...campaigns];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setCampaigns(next);
    setTitle("");
    setDescription("");
    setInstructions("");
    setReference("");
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
          <Link
            href="/prollys"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-800"
          >
            Explore
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Sponsor Dashboard
        </p>
        <h1 className="mt-4 text-4xl font-bold">Build your campaign brief.</h1>
        <p className="mt-4 max-w-3xl text-zinc-400">
          Prepare a sponsor Prolly using one of the three supported post
          formats. This dashboard does not decide winners and does not alter
          the deployed GenLayer contract.
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
                ["generated-link", "Generated Link"],
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
                        : "Link or access code"}
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
              Saved sponsor briefs for this browser.
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
                            ? "Generated Link"
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
