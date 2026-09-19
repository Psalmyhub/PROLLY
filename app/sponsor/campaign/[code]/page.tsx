"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import {
  areWinnersFinalized,
  finalizeWinners,
  getParticipantCount,
  getSponsorOnChainProlly,
  isClosed,
  joinSponsorLink,
  type SponsorOnChainProlly,
} from "@/lib/genlayer";

function formatExpiry(seconds: bigint) {
  if (seconds <= 0n) return "Not set";

  return new Date(
    Number(seconds) * 1000,
  ).toLocaleString();
}

function rewardText(
  campaign: SponsorOnChainProlly,
) {
  if (campaign.rewardType === "fun") {
    return "Just for fun";
  }

  if (
    campaign.rewardType === "other" &&
    campaign.rewardLabel
  ) {
    return `${campaign.rewardLabel} — ${campaign.rewardAmount} ${campaign.rewardCurrency}`.trim();
  }

  return `${campaign.rewardAmount} ${campaign.rewardCurrency} per winner`.trim();
}

export default function SponsorCampaignPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { address } = useAccount();

  const code = String(params.code);
  const accessToken =
    searchParams.get("token") ?? "";

  const [campaign, setCampaign] =
    useState<SponsorOnChainProlly | null>(
      null,
    );

  const [participantCount, setParticipantCount] =
    useState<bigint>(0n);

  const [closed, setClosed] =
    useState(false);

  const [finalized, setFinalized] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [joining, setJoining] =
    useState(false);

  const [finalizing, setFinalizing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [now, setNow] = useState(
    () => Math.floor(Date.now() / 1000),
  );

  const prollyId = (() => {
    try {
      return BigInt(code);
    } catch {
      return null;
    }
  })();

  async function loadCampaign() {
    if (prollyId === null) {
      setLoading(false);
      setCampaign(null);
      return;
    }

    try {
      const [
        loaded,
        count,
        closedState,
        finalizedState,
      ] = await Promise.all([
        getSponsorOnChainProlly(
          prollyId,
        ),
        getParticipantCount(
          prollyId,
        ),
        isClosed(prollyId),
        areWinnersFinalized(
          prollyId,
        ),
      ]);

      if (
        !loaded ||
        loaded.mode !== "link" ||
        loaded.id !== prollyId
      ) {
        setCampaign(null);
        return;
      }

      setCampaign(loaded);
      setParticipantCount(count);
      setClosed(closedState);
      setFinalized(finalizedState);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaign();
  }, [code]);

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        setNow(
          Math.floor(
            Date.now() / 1000,
          ),
        );
      },
      1000,
    );

    return () =>
      window.clearInterval(timer);
  }, []);

  const expired =
    !!campaign &&
    campaign.accessExpiry > 0n &&
    BigInt(now) >=
      campaign.accessExpiry;

  const full =
    !!campaign &&
    participantCount >=
      campaign.maxParticipants;

  const open =
    !!campaign &&
    campaign.mode === "link" &&
    !closed &&
    !expired &&
    !full;

  async function join() {
    if (!address) {
      setMessage(
        "Connect the wallet you want to use for this Sponsor Prolly.",
      );
      return;
    }

    if (prollyId === null) {
      setMessage(
        "Invalid Sponsor Prolly ID.",
      );
      return;
    }

    if (!accessToken) {
      setMessage(
        "This private access link is missing its access token.",
      );
      return;
    }

    if (!open) {
      setMessage(
        "This Sponsor Prolly is no longer open for joining.",
      );
      return;
    }

    setJoining(true);
    setMessage(
      "Submitting your wallet to GenLayer. Confirm the transaction in your wallet...",
    );

    try {
      await joinSponsorLink(
        address,
        prollyId,
        accessToken,
      );

      setMessage(
        "You joined successfully. Your wallet is now recorded on-chain.",
      );

      await loadCampaign();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setJoining(false);
    }
  }

  async function finalize() {
    if (!address) {
      setMessage(
        "Connect a wallet before finalizing.",
      );
      return;
    }

    if (prollyId === null) {
      setMessage(
        "Invalid Sponsor Prolly ID.",
      );
      return;
    }

    if (!closed && !expired && !full) {
      setMessage(
        "This Sponsor Prolly is still open.",
      );
      return;
    }

    if (finalized) {
      setMessage(
        "The winners have already been finalized.",
      );
      return;
    }

    setFinalizing(true);
    setMessage(
      "Finalizing winners through GenLayer...",
    );

    try {
      await finalizeWinners(
        address,
        prollyId,
      );

      setMessage(
        "Winners finalized by GenLayer. The stored winners are now authoritative.",
      );

      await loadCampaign();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <p className="text-sm uppercase tracking-widest text-cyan-400">
            GenLayer
          </p>

          <h1 className="mt-4 text-2xl font-bold">
            Loading Sponsor Prolly...
          </h1>

          <p className="mt-3 text-zinc-500">
            Reading the authoritative campaign
            state from the deployed contract.
          </p>
        </div>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-bold">
            Sponsor Prolly unavailable
          </h1>

          <p className="mt-4 text-zinc-500">
            This Sponsor Link Prolly does not exist,
            is not a Link Prolly, or could not be
            loaded from GenLayer.
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

  return (
    <main className="min-h-screen bg-zinc-950 px-4 text-white sm:px-0">
      <nav className="border-b border-zinc-800">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
          <Link
            href="/"
            className="text-2xl font-bold"
          >
            PROLLY
            <span className="text-violet-400">
              .
            </span>
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm uppercase tracking-widest text-cyan-400">
          Private Sponsor Access
        </p>

        <div className="mt-3 inline-flex rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-500">
          GenLayer Prolly #{campaign.id.toString()}
        </div>

        <h1 className="mt-5 text-3xl font-bold sm:text-4xl">
          {campaign.name}
        </h1>

        <p className="mt-5 text-lg leading-8 text-zinc-400">
          {campaign.description}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-500">
              Winners
            </p>

            <p className="mt-2 text-2xl font-bold">
              {campaign.winnerCount.toString()}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-500">
              Maximum participants
            </p>

            <p className="mt-2 text-2xl font-bold">
              {campaign.maxParticipants.toString()}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-500">
              Participants
            </p>

            <p className="mt-2 text-2xl font-bold">
              {participantCount.toString()}
              <span className="text-base font-normal text-zinc-500">
                {" "}
                /{" "}
                {campaign.maxParticipants.toString()}
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <p className="text-xs text-zinc-500">
              Reward
            </p>

            <p className="mt-2 font-semibold">
              {rewardText(campaign)}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:col-span-2">
            <p className="text-xs text-zinc-500">
              Access expires
            </p>

            <p className="mt-2 font-semibold">
              {formatExpiry(
                campaign.accessExpiry,
              )}
            </p>
          </div>
        </div>

        <div
          className={`mt-8 rounded-3xl border p-6 ${
            finalized
              ? "border-emerald-500/20 bg-emerald-500/5"
              : expired || full || closed
                ? "border-zinc-700 bg-zinc-900"
                : "border-cyan-500/20 bg-cyan-500/5"
          }`}
        >
          <p className="font-semibold">
            {finalized
              ? "Winners finalized"
              : expired
                ? "Access expired"
                : full
                  ? "Participant limit reached"
                  : closed
                    ? "Prolly closed"
                    : "Access open"}
          </p>

          <p className="mt-2 text-sm text-zinc-400">
            {finalized
              ? "GenLayer has finalized and stored the authoritative winners. The Battle experience may reveal those same winners visually."
              : expired
                ? "The access window has expired. No new participant can join through this link."
                : full
                  ? "The maximum participant count has been reached. The participant pool is now closed."
                  : closed
                    ? "This Sponsor Prolly has been closed and can no longer accept participants."
                    : "This private link is active. Joining records your connected wallet directly on-chain."}
          </p>

          {open && (
            <button
              onClick={() => void join()}
              disabled={joining}
              className="mt-5 w-full rounded-full bg-cyan-400 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joining
                ? "Joining on GenLayer..."
                : "Join Sponsor Prolly"}
            </button>
          )}

          {(closed ||
            expired ||
            full) &&
            !finalized && (
              <button
                onClick={() =>
                  void finalize()
                }
                disabled={finalizing}
                className="mt-3 w-full rounded-full border border-violet-500/40 bg-violet-500/10 py-3 font-semibold text-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {finalizing
                  ? "Finalizing on GenLayer..."
                  : "Finalize Winners"}
              </button>
            )}
        </div>

        {message && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-xs uppercase tracking-widest text-zinc-600">
            Transparency
          </p>

          <p className="mt-3 text-sm leading-6 text-zinc-500">
            Your wallet address is the authoritative
            participant identity. The access token only
            proves that you have the private sponsor link.
            Winner selection is not performed by this page,
            the sponsor, or the animation. Finalized
            winners come from GenLayer.
          </p>
        </div>
      </section>
    </main>
  );
}
