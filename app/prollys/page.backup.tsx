"use client";

import Link from "next/link";
import { useState } from "react";

type Prolly = {
  id: number;
  title: string;
  description: string;
  entryAmount: number;
  participants: number;
  maxParticipants: number;
  winners: number;
  status: "LIVE" | "ENDING SOON";
};

const initialProllys: Prolly[] = [
  {
    id: 1,
    title: "Lucky 10",
    description:
      "Join the pool for a chance to become one of 10 randomly selected winners.",
    entryAmount: 1,
    participants: 73,
    maxParticipants: 100,
    winners: 10,
    status: "LIVE",
  },
  {
    id: 2,
    title: "Community Drop",
    description:
      "A community reward pool where 20 participants will be randomly selected.",
    entryAmount: 2,
    participants: 142,
    maxParticipants: 200,
    winners: 20,
    status: "LIVE",
  },
  {
    id: 3,
    title: "Big Chance",
    description:
      "A limited-entry Prolly with only two spots remaining before selection.",
    entryAmount: 5,
    participants: 48,
    maxParticipants: 50,
    winners: 5,
    status: "ENDING SOON",
  },
];

export default function ProllysPage() {
  const [prollys, setProllys] = useState(initialProllys);
  const [selectedProlly, setSelectedProlly] = useState<Prolly | null>(null);
  const [joined, setJoined] = useState<number[]>([]);

  function joinProlly(prolly: Prolly) {
    if (prolly.participants >= prolly.maxParticipants) {
      return;
    }

    if (joined.includes(prolly.id)) {
      return;
    }

    setProllys((current) =>
      current.map((item) =>
        item.id === prolly.id
          ? { ...item, participants: item.participants + 1 }
          : item,
      ),
    );

    setJoined((current) => [...current, prolly.id]);
    setSelectedProlly(null);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            PROLLY<span className="text-violet-400">.</span>
          </Link>

          <Link
            href="/"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          >
            Home
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Explore
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Choose your Prolly.
          </h1>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            Enter an active Prolly and let probability determine the winners.
            Every participant has a chance.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {prollys.map((prolly) => {
            const progress =
              (prolly.participants / prolly.maxParticipants) * 100;

            const prizePool = prolly.entryAmount * prolly.participants;

            const hasJoined = joined.includes(prolly.id);

            return (
              <div
                key={prolly.id}
                className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-violet-500/50"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                    {prolly.status}
                  </span>

                  <span className="text-sm text-zinc-500">
                    {prolly.participants}/{prolly.maxParticipants}
                  </span>
                </div>

                <h2 className="mt-6 text-2xl font-bold">{prolly.title}</h2>

                <p className="mt-3 min-h-14 text-sm leading-6 text-zinc-400">
                  {prolly.description}
                </p>

                <div className="mt-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Entry fee</span>
                    <span className="font-semibold">
                      ${prolly.entryAmount}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-zinc-500">Prize pool</span>
                    <span className="font-semibold">${prizePool}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-zinc-500">Winners</span>
                    <span className="font-semibold">{prolly.winners}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-xs text-zinc-500">
                    <span>Participants</span>
                    <span>{Math.round(progress)}%</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <a
                  href={`/prollys/${prolly.id}`}
                  className="mt-7 block w-full rounded-full bg-violet-500 py-3 text-center font-semibold hover:bg-violet-400"
                >
                  Join Prolly
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {selectedProlly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
                  Confirm entry
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  {selectedProlly.title}
                </h2>
              </div>

              <button
                onClick={() => setSelectedProlly(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-8 space-y-4 rounded-2xl bg-zinc-900 p-5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Entry fee</span>
                <span className="font-semibold">
                  ${selectedProlly.entryAmount}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">Current participants</span>
                <span className="font-semibold">
                  {selectedProlly.participants}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">Current prize pool</span>
                <span className="font-semibold">
                  $
                  {selectedProlly.entryAmount *
                    selectedProlly.participants}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">Potential pool after joining</span>
                <span className="font-semibold text-violet-400">
                  $
                  {selectedProlly.entryAmount *
                    (selectedProlly.participants + 1)}
                </span>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              This is currently a prototype. No real payment or blockchain
              transaction will occur.
            </p>

            <button
              onClick={() => joinProlly(selectedProlly)}
              className="mt-7 w-full rounded-full bg-violet-500 py-3 font-semibold hover:bg-violet-400"
            >
              Confirm & Join
            </button>

            <button
              onClick={() => setSelectedProlly(null)}
              className="mt-3 w-full rounded-full border border-zinc-800 py-3 font-semibold hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
