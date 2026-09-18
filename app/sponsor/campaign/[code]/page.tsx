"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Campaign = {
  id: string;
  title: string;
  type: "manual" | "task" | "generated-link";
  description: string;
  instructions: string;
  reference: string;
  createdAt: number;
  accessCode?: string;
};

const STORAGE_KEY = "prolly-sponsor-campaigns";

export default function CampaignAccessPage() {
  const params = useParams();
  const code = String(params.code);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const campaigns = saved ? (JSON.parse(saved) as Campaign[]) : [];
      setCampaign(campaigns.find((item) => item.accessCode === code) ?? null);
    } finally {
      setLoading(false);
    }
  }, [code]);

  if (loading) {
    return <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center"><p className="text-zinc-400">Loading campaign...</p></main>;
  }

  if (!campaign) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-bold">Campaign link not found</h1>
          <p className="mt-4 text-zinc-500">This generated campaign link is not available in this browser prototype.</p>
          <Link href="/prollys" className="mt-6 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold">Explore Prollys</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">PROLLY<span className="text-violet-400">.</span></Link>
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">Generated Link</span>
        </div>
      </nav>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">Sponsor Campaign</p>
        <h1 className="mt-4 text-4xl font-bold">{campaign.title}</h1>
        <p className="mt-5 text-lg leading-8 text-zinc-400">{campaign.description}</p>
        {campaign.instructions && (
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Instructions</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{campaign.instructions}</p>
          </div>
        )}
        {campaign.reference && (
          <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6">
            <p className="text-xs uppercase tracking-widest text-zinc-600">Reference</p>
            <p className="mt-3 break-all text-sm text-cyan-300">{campaign.reference}</p>
          </div>
        )}
        <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
          <p className="font-semibold text-amber-300">Prototype access page</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            This generated link currently exposes the saved campaign brief only. It does not bypass wallet checks, create an on-chain participant, or select a winner. Final participation remains controlled by the deployed GenLayer contract.
          </p>
        </div>
        <Link href="/prollys" className="mt-8 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400">Explore Prollys</Link>
      </section>
    </main>
  );
}
