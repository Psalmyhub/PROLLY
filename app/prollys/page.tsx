
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadProllys,
  saveProllys,
  shouldCloseProlly,
  type Prolly,
} from "@/lib/prolly-store";
import { loadProfile, type UserProfile } from "@/lib/profile-store";
export default function ProllysPage() {
  const [prollys, setProllys] = useState<Prolly[]>([]);
  const [selectedProlly, setSelectedProlly] = useState<Prolly | null>(null);
const [profile, setProfile] = useState<UserProfile | null>(null);
  // Load Prollys when the Explore page opens
  useEffect(() => {
    const stored = loadProllys();
    setProllys(stored);
const savedProfile = loadProfile();
  setProfile(savedProfile);
  }, []);

  // Check for expired/full Prollys periodically
  useEffect(() => {
    const checkClosedProllys = () => {
      setProllys((current) => {
        let changed = false;

        const updated = current.map((prolly) => {
          if (shouldCloseProlly(prolly)) {
            changed = true;
          }

          return prolly;
        });

        if (changed) {
          saveProllys(updated);
        }

        return updated;
      });
    };

    checkClosedProllys();

    const interval = setInterval(checkClosedProllys, 1000);

    return () => clearInterval(interval);
  }, []);

  function joinProlly(prolly: Prolly) {
    // Check again immediately before joining
    if (shouldCloseProlly(prolly)) {
      alert("This Prolly is closed.");
      setSelectedProlly(null);
      return;
    }

    if (prolly.participants >= prolly.maxParticipants) {
      alert("This Prolly is full.");
      setSelectedProlly(null);
      return;
    }

    const updatedProllys = prollys.map((item) =>
      item.id === prolly.id
        ? {
            ...item,
            participants: item.participants + 1,
          }
        : item,
    );

    setProllys(updatedProllys);
    saveProllys(updatedProllys);

    setSelectedProlly(null);
  }

  const selectedPool = useMemo(() => {
    if (!selectedProlly) return 0;

    return (
      selectedProlly.entryAmount * selectedProlly.participants
    );
  }, [selectedProlly]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* NAVIGATION */}
      <nav className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <a
            href="/"
            className="text-2xl font-bold tracking-tight"
          >
            PROLLY<span className="text-violet-400">.</span>
          </a>

          <a
            href="/admin"
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800"
          >
            Create a Prolly
          </a>
        </div>
      </nav>

      {/* EXPLORE HEADER */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Explore
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
            Choose your Prolly.
          </h1>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            Pick an active Prolly and join immediately. Every
            participant gets one opportunity.
          </p>
        </div>

        {/* PROLLY CARDS */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {prollys.map((prolly) => {
            const pool =
              prolly.entryAmount * prolly.participants;

            const isFull =
              prolly.participants >= prolly.maxParticipants;

            const isClosed = shouldCloseProlly(prolly);

            return (
              <article
                key={prolly.id}
                className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50"
              >
                <div className="p-6">
                  {/* TITLE */}
                  <h2 className="text-2xl font-bold">
                    {prolly.title || "Untitled Prolly"}
                  </h2>

                  {/* DESCRIPTION */}
                  <p className="mt-3 min-h-14 text-sm leading-6 text-zinc-400">
                    {prolly.description ||
                      "No description provided."}
                  </p>

                  {/* IMAGE PLACEHOLDER */}
                  <div className="mt-6 flex h-48 items-center justify-center rounded-2xl bg-zinc-800">
                    <span className="text-sm text-zinc-600">
                      Prolly image
                    </span>
                  </div>

                  {/* DETAILS */}
                  <div className="mt-6 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Entry fee
                      </span>

                      <span className="font-medium">
                        ${prolly.entryAmount}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Participants
                      </span>

                      <span className="font-medium">
                        {prolly.participants} /{" "}
                        {prolly.maxParticipants}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Prize pool
                      </span>

                      <span className="font-semibold text-violet-400">
                        ${pool}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-500">
                        Winners
                      </span>

                      <span className="font-medium">
                        {prolly.winners}
                      </span>
                    </div>
                  </div>

                  {/* JOIN BUTTON */}
                  <button
                    disabled={isClosed || isFull}
                    onClick={() =>
                      setSelectedProlly(prolly)
                    }
                    className={`mt-7 w-full rounded-full py-3 font-semibold ${
                      isClosed || isFull
                        ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                        : "bg-violet-500 hover:bg-violet-400"
                    }`}
                  >
                    {isClosed
                      ? "Prolly Closed"
                      : isFull
                        ? "Prolly Full"
                        : "Join Prolly"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {prollys.length === 0 && (
          <div className="mt-12 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <p className="text-zinc-400">
              No Prollys are available yet.
            </p>

            <a
              href="/admin"
              className="mt-5 inline-block rounded-full bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400"
            >
              Create a Prolly
            </a>
          </div>
        )}
      </section>

      {/* JOIN MODAL */}
      {selectedProlly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
              Join Prolly
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              {selectedProlly.title ||
                "Untitled Prolly"}
            </h2>

            <p className="mt-4 text-sm leading-6 text-zinc-400">
              {selectedProlly.description ||
                "No description provided."}
            </p>

            <div className="mt-7 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Entry fee
                </span>

                <span>
                  ${selectedProlly.entryAmount}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Participants
                </span>

                <span>
                  {selectedProlly.participants} /{" "}
                  {selectedProlly.maxParticipants}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Current prize pool
                </span>

                <span className="font-semibold text-violet-400">
                  ${selectedPool}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Winners
                </span>

                <span>{selectedProlly.winners}</span>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Prototype only. No real payment or blockchain
              transaction will occur.
            </p>

            <button
              onClick={() =>
                joinProlly(selectedProlly)
              }
              className="mt-7 w-full rounded-full bg-violet-500 py-3 font-semibold hover:bg-violet-400"
            >
              Confirm & Join
            </button>

            <button
              onClick={() =>
                setSelectedProlly(null)
              }
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
