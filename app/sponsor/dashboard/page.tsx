"use client";

import { useAccount } from "wagmi";
import { getRole } from "@/lib/role-store";

const ADMIN_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS;

export default function SponsorDashboard() {
    const { address } = useAccount();

  const approved =
    !!address && getRole(address, ADMIN_ADDRESS) === "sponsor";

  if (!approved) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        <div className="mx-auto max-w-2xl pt-20">
          <h1 className="text-3xl font-bold">
            Sponsor access required
          </h1>

          <p className="mt-4 text-zinc-400">
            Only approved sponsors can access this dashboard.
          </p>

          <a
            href="/sponsor"
            className="mt-6 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold"
          >
            Sponsor Application
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Sponsor Dashboard
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Manage your campaigns.
        </h1>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7">
            <h2 className="text-xl font-semibold">
              Create Campaign
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              Create a sponsored Prolly task.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7">
            <h2 className="text-xl font-semibold">
              My Campaigns
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              View and manage your campaigns.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7">
            <h2 className="text-xl font-semibold">
              Submissions
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              Review qualified submissions.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
