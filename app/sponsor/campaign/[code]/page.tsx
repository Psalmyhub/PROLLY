"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  loadAllSponsorCampaigns,
  type SponsorCampaign,
} from "@/lib/sponsor-store";

function formatTime(ts?: number) {
  return ts ? new Date(ts).toLocaleString() : "Not scheduled";
}

export default function SponsorCampaignPage() {
  const params = useParams();
  const token = String(params.code);

  const [campaign, setCampaign] = useState<SponsorCampaign | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setCampaign(
      loadAllSponsorCampaigns().find(
        (c) =>
          c.type === "link" &&
          c.accessToken === token &&
          c.status === "published",
      ) ?? null,
    );
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!campaign) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-bold">Access link unavailable</h1>

          <p className="mt-4 text-zinc-500">
            This Sponsor Link Prolly does not exist, has not been published,
            or its private access link is no longer valid.
          </p>

          <Link
            href="/prollys"
            className="mt-6 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold"
          >
            Explore Prollys
          </Link>
        </div>
      </main>
    );
  }

  const expired = !!campaign.expiresAt && now >= campaign.expiresAt;
  const open = campaign.status === "published" && !expired;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 text-white sm:px-0">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
          <Link href="/" className="text-2xl font-bold">
            PROLLY<span className="text-violet-400">.</span>
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm uppercase tracking-widest text-cyan-400">
          Private Sponsor Access
        </p>

        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
          {campaign.topic}
        </h1>

        <p className="mt-5 text-lg leading-8 text-zinc-400">
          {campaign.description}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-500">Winners</p>
            <p className="mt-2 text-2xl font-bold">
              {campaign.winnerCount}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-500">Maximum participants</p>
            <p className="mt-2 text-2xl font-bold">
              {campaign.maxParticipants}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-500">Reward</p>
            <p className="mt-2 font-semibold">
              {campaign.rewardType === "fun"
                ? "Just for fun"
                : `${campaign.rewardAmount ?? "Reward"} ${
                    campaign.rewardCurrency ?? ""
                  } per winner`.trim()}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-500">Access expires</p>
            <p className="mt-2 font-semibold">
              {formatTime(campaign.expiresAt)}
            </p>
          </div>
        </div>

        <div
          className={`mt-8 rounded-3xl border p-6 ${
            expired
              ? "border-zinc-700 bg-zinc-900"
              : "border-cyan-500/20 bg-cyan-500/5"
          }`}
        >
          <p className="font-semibold">
            {expired ? "Access expired" : "Access status"}
          </p>

          <p className="mt-2 text-sm text-zinc-400">
            {expired
              ? "The private access link remains active for people who have it until the sponsor-set expiration time."
              : "This private link is intentionally distributed by the sponsor through their community or social channels."}
          </p>

          {open && !expired && (
            <button className="mt-5 w-full rounded-full bg-cyan-400 py-3 font-semibold text-black">
              Join Sponsor Prolly
            </button>
          )}
        </div>

        {!open && !expired && (
          <p className="mt-6 text-center text-sm text-zinc-500">
            This private access link is not active yet or has expired.
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {campaign.communityLinks.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-cyan-300"
            >
              {l.label}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
