"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { PROLLY_CONTRACT_OWNER } from "@/lib/genlayer";
import {
  getRole,
  getSponsorApplication,
  submitSponsorApplication,
  type UserRole,
} from "@/lib/role-store";

const ADMIN_ADDRESS = PROLLY_CONTRACT_OWNER;

export default function SponsorPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<UserRole>("user");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address) {
      setRole("user");
      return;
    }

    setRole(getRole(address, ADMIN_ADDRESS));

    const application = getSponsorApplication(address);
    if (application) {
      setName(application.name);
      setDescription(application.description);
      setWebsite(application.website ?? "");
    }
  }, [address]);

  function apply() {
    if (!address) {
      setMessage("Please connect your wallet first.");
      return;
    }

    if (role === "admin") {
      setMessage("Admin wallets already have administrator access.");
      return;
    }

    if (!name.trim()) {
      setMessage("Please enter your sponsor name.");
      return;
    }

    if (!description.trim()) {
      setMessage("Please describe what you want to sponsor.");
      return;
    }

    submitSponsorApplication({
      walletAddress: address,
      name: name.trim(),
      description: description.trim(),
      website: website.trim(),
      status: "pending",
      createdAt: Date.now(),
    });

    setRole("sponsor_pending");
    setMessage(
      "Application submitted. An admin must approve your sponsor role.",
    );
  }

  if (!mounted) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
          <p className="text-zinc-400">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            PROLLY<span className="text-violet-400">.</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/prollys"
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm hover:bg-zinc-800"
            >
              Explore
            </Link>
            <WorkspaceSwitcher />
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
          Sponsor
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Become a Prolly sponsor.
        </h1>

        {!isConnected ? (
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
            <p className="text-zinc-400">
              Connect your wallet first to apply for sponsor status.
            </p>
          </div>
        ) : role === "admin" ? (
          <div className="mt-8 rounded-3xl border border-violet-500/30 bg-violet-500/10 p-8">
            <h2 className="text-xl font-semibold">Admin account</h2>
            <p className="mt-3 leading-7 text-zinc-400">
              This wallet has administrator privileges and can open both
              workspaces.
            </p>
            <Link
              href="/admin"
              className="mt-6 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold"
            >
              Open Admin Workspace
            </Link>
          </div>
        ) : role === "sponsor" ? (
          <div className="mt-8 rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-8">
            <h2 className="text-2xl font-semibold">
              You are an approved sponsor.
            </h2>
            <p className="mt-3 leading-7 text-zinc-400">
              Your wallet is approved for the Sponsor workspace. Sponsor
              campaign creation remains subject to the current on-chain
              contract architecture.
            </p>
            <Link
              href="/sponsor/dashboard"
              className="mt-6 inline-block rounded-full bg-cyan-500 px-6 py-3 font-semibold text-black"
            >
              Open Sponsor Workspace
            </Link>
          </div>
        ) : role === "sponsor_pending" ? (
          <div className="mt-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-8">
            <h2 className="text-2xl font-semibold">Application pending</h2>
            <p className="mt-3 leading-7 text-zinc-400">
              Your sponsor application has been submitted. An admin must
              approve your wallet before sponsor workspace access is granted.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8">
            <label className="text-sm font-medium text-zinc-300">
              Sponsor / Organization name
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name or organization"
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
            />

            <label className="mt-6 block text-sm font-medium text-zinc-300">
              What do you want to sponsor?
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your campaign..."
              rows={5}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
            />

            <label className="mt-6 block text-sm font-medium text-zinc-300">
              Website <span className="text-zinc-600">(optional)</span>
            </label>

            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-violet-500"
            />

            <button
              onClick={apply}
              className="mt-7 w-full rounded-full bg-violet-500 py-3 font-semibold hover:bg-violet-400"
            >
              Apply for Sponsor Status
            </button>

            {message && (
              <p className="mt-4 text-center text-sm text-zinc-400">
                {message}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
