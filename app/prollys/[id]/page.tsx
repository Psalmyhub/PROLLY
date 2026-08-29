"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";

const prollyData = {
  "1": {
    title: "Lucky 10",
    description:
      "Join the pool for a chance to become one of 10 randomly selected winners. Every participant has an equal opportunity to win.",
    entryAmount: 1,
    participants: 74,
    maxParticipants: 100,
    winners: 10,
    status: "LIVE",
  },
  "2": {
    title: "Community Drop",
    description:
      "A community reward pool where 20 participants will be randomly selected.",
    entryAmount: 2,
    participants: 142,
    maxParticipants: 200,
    winners: 20,
    status: "LIVE",
  },
  "3": {
    title: "Big Chance",
    description:
      "A limited-entry Prolly with only two spots remaining before random selection.",
    entryAmount: 5,
    participants: 48,
    maxParticipants: 50,
    winners: 5,
    status: "ENDING SOON",
  },
};

export default function ProllyDetailsPage() {
    const params = useParams();

  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  const [joined, setJoined] = useState(false);

  const id = String(params.id);
const prolly = prollyData[id as keyof typeof prollyData];


  if (!prolly) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Prolly not found</h1>
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

  const prizePool = prolly.entryAmount * prolly.participants;
  const potentialPrizePool =
    prolly.entryAmount * (prolly.participants + (joined ? 0 : 1));

  const estimatedWinnerPrize = prizePool / prolly.winners;

  function handleJoin() {
  if (!isConnected) {
    const connector = connectors.find(
      (item) => item.name === "MetaMask",
    );

    if (!connector) {
      alert("MetaMask is not available.");
      return;
    }

    connect({ connector });
    return;
  }

  setJoined(true);
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
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          >
            Explore Prollys
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-2">
          {/* Image placeholder */}
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

          {/* Details */}
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                {prolly.status}
              </span>

              <span className="text-sm text-zinc-500">
                {prolly.participants}/{prolly.maxParticipants} joined
              </span>
            </div>

            <h1 className="mt-5 text-5xl font-bold tracking-tight">
              {prolly.title}
            </h1>

            <p className="mt-6 text-lg leading-8 text-zinc-400">
              {prolly.description}
            </p>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">Entry fee</p>
                <p className="mt-2 text-2xl font-bold">
                  ${prolly.entryAmount}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">Prize pool</p>
                <p className="mt-2 text-2xl font-bold text-violet-400">
                  ${joined ? potentialPrizePool : prizePool}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">Participants</p>
                <p className="mt-2 text-2xl font-bold">
                  {prolly.participants + (joined ? 1 : 0)}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-sm text-zinc-500">Winners</p>
                <p className="mt-2 text-2xl font-bold">
                  {prolly.winners}
                </p>
              </div>
            </div>

            {/* Estimated payout */}
            <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
              <p className="text-sm text-zinc-500">
                Estimated prize per winner
              </p>

              <p className="mt-2 text-2xl font-bold text-violet-400">
                ${(joined ? potentialPrizePool : prizePool) / prolly.winners}
              </p>

              <p className="mt-2 text-xs text-zinc-600">
                Based on the current prize pool and number of winners.
              </p>
            </div>

            {/* Join */}
            <button
  onClick={handleJoin}
  disabled={joined || isPending}
  className="mt-8 w-full rounded-full bg-violet-500 py-4 text-lg font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-emerald-500"
>
  {joined
    ? "Joined Prolly ✓"
    : isPending
      ? "Connecting..."
      : isConnected
        ? `Join Prolly — $${prolly.entryAmount}`
        : "Connect wallet to join"}
</button>

            <p className="mt-4 text-center text-xs text-zinc-600">
              Prototype mode — no real payment or blockchain transaction.
            </p>
          </div>
        </div>

        {/* How it works */}
        <section className="mt-20 border-t border-zinc-800 pt-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              How this Prolly works
            </p>

            <h2 className="mt-4 text-3xl font-bold">
              Simple. Transparent. Random.
            </h2>

            <p className="mt-5 leading-8 text-zinc-400">
              Participants enter the Prolly with the required entry amount.
              The prize pool grows as more participants join.
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
                Enter the Prolly by paying the required entry amount.
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
                The Prolly closes when its participant limit or time
                condition is reached.
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
                Winners are selected through a transparent random process.
              </p>
            </div>
          </div>
        </section>

        {/* Transparency */}
        <section className="mt-20 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Transparency
          </p>

          <h2 className="mt-4 text-2xl font-bold">
            Everyone should be able to verify the outcome.
          </h2>

          <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
            Prolly is designed so that participation, closing conditions,
            winner selection, and prize distribution can ultimately be
            verified on-chain.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="font-semibold">Open participation</p>
              <p className="mt-2 text-sm text-zinc-500">
                Participants can see the important Prolly information before
                joining.
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="font-semibold">Random selection</p>
              <p className="mt-2 text-sm text-zinc-500">
                Winner selection will use verifiable randomness rather than
                manual selection.
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="font-semibold">On-chain verification</p>
              <p className="mt-2 text-sm text-zinc-500">
                The final production version will allow users to verify the
                important results on-chain.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
