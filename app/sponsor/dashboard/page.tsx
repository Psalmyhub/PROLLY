"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import WorkspaceSwitcher from "@/app/components/WorkspaceSwitcher";
import { getRole } from "@/lib/role-store";
import {
  createSponsorProlly,
  getSponsorFeeGen,
  PROLLY_CONTRACT_OWNER,
} from "@/lib/genlayer";
import {
  loadSponsorCampaigns,
  removeSponsorCampaign,
  saveSponsorCampaigns,
  type SponsorCampaign,
  type SponsorParticipant,
  type SponsorRewardType,
} from "@/lib/sponsor-store";

function makeToken() {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

function formatTime(ts?: number) {
  return ts ? new Date(ts).toLocaleString() : "Not set";
}

function rewardName(
  type: SponsorRewardType,
  label?: string,
) {
  if (type === "xp") return "XP Reward";
  if (type === "crypto") return "Crypto Reward";
  if (type === "fun") return "Just for Fun";

  return label?.trim() || "Other";
}

export default function SponsorDashboard() {
  const { address } = useAccount();

  const [campaigns, setCampaigns] =
    useState<SponsorCampaign[]>([]);

  const [type, setType] =
    useState<"link" | "manual">("link");

  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [winnerCount, setWinnerCount] = useState("1");
  const [maxParticipants, setMaxParticipants] =
    useState("100");

  const [rewardType, setRewardType] =
    useState<SponsorRewardType>("xp");

  const [rewardAmount, setRewardAmount] =
    useState("");

  const [rewardCurrency, setRewardCurrency] =
    useState("NGN");

  const [rewardLabel, setRewardLabel] =
    useState("");

  const [expiresAt, setExpiresAt] = useState("");
  const [community, setCommunity] = useState("");

  const [participants, setParticipants] =
    useState<SponsorParticipant[]>([
      {
        username: "",
        walletAddress: "",
      },
    ]);

  const [message, setMessage] = useState("");
  const [busyCampaignId, setBusyCampaignId] =
    useState<string | null>(null);

  const approved =
    !!address &&
    ["sponsor", "admin"].includes(
      getRole(address, PROLLY_CONTRACT_OWNER),
    );

  useEffect(() => {
    setCampaigns(
      address
        ? loadSponsorCampaigns(address)
        : [],
    );
  }, [address]);

  function updateParticipant(
    index: number,
    value: string,
  ) {
    setParticipants((current) =>
      current.map((participant, i) =>
        i === index
          ? {
              username: value.startsWith("@")
                ? value.slice(1)
                : "",
              walletAddress: value.startsWith("0x")
                ? value
                : "",
            }
          : participant,
      ),
    );
  }

  function addParticipant() {
    setParticipants((current) => [
      ...current,
      {
        username: "",
        walletAddress: "",
      },
    ]);
  }

  function removeParticipant(index: number) {
    setParticipants((current) =>
      current.length <= 1
        ? current
        : current.filter(
            (_, i) => i !== index,
          ),
    );
  }

  function resetForm() {
    setTopic("");
    setDescription("");
    setWinnerCount("1");
    setMaxParticipants("100");
    setRewardType("xp");
    setRewardAmount("");
    setRewardCurrency("NGN");
    setRewardLabel("");
    setExpiresAt("");
    setParticipants([
      {
        username: "",
        walletAddress: "",
      },
    ]);
    setCommunity("");
  }

  function createCampaign() {
    if (!address) {
      setMessage(
        "Connect your sponsor wallet first.",
      );
      return;
    }

    const winners = Number(winnerCount);
    const max = Number(maxParticipants);

    if (!topic.trim() || !description.trim()) {
      setMessage(
        "Topic and description are required.",
      );
      return;
    }

    if (
      !Number.isInteger(winners) ||
      winners < 1 ||
      winners > max
    ) {
      setMessage(
        "Winner count must be between 1 and maximum participants.",
      );
      return;
    }

    if (!Number.isInteger(max) || max < 1) {
      setMessage(
        "Maximum participants must be at least 1.",
      );
      return;
    }

    if (
      rewardType !== "fun" &&
      (!rewardAmount.trim() ||
        Number(rewardAmount) <= 0)
    ) {
      setMessage(
        "Enter a reward amount for each winner.",
      );
      return;
    }

    const selected: SponsorParticipant[] =
      type === "manual"
        ? participants
            .map((p) => ({
              username: p.username?.trim(),
              walletAddress:
                p.walletAddress.trim(),
            }))
            .filter(
              (p) =>
                p.username ||
                p.walletAddress,
            )
        : [];

    if (
      type === "manual" &&
      selected.length !== max
    ) {
      setMessage(
        `Add exactly ${max} selected participants before saving.`,
      );
      return;
    }

    if (type === "manual") {
      const missingWallet = selected.some(
        (participant) =>
          !participant.walletAddress ||
          !participant.walletAddress
            .toLowerCase()
            .startsWith("0x"),
      );

      if (missingWallet) {
        setMessage(
          "Every Manual Prolly participant must have a wallet address. The wallet is the authoritative on-chain identity.",
        );
        return;
      }

      const wallets = selected.map((participant) =>
        participant.walletAddress.toLowerCase(),
      );

      if (
        new Set(wallets).size !== wallets.length
      ) {
        setMessage(
          "Manual Prolly participants cannot contain duplicate wallet addresses.",
        );
        return;
      }
    }

    if (type === "link" && !expiresAt) {
      setMessage(
        "Choose an access-link expiration time.",
      );
      return;
    }

    if (
      type === "link" &&
      (!expiresAt ||
        Number(expiresAt) < 15 ||
        Number(expiresAt) > 60)
    ) {
      setMessage(
        "Choose an access expiration between 15 minutes and 1 hour.",
      );
      return;
    }

    const expiry =
      type === "link"
        ? Date.now() +
          Number(expiresAt) * 60 * 1000
        : undefined;

    const campaign: SponsorCampaign = {
      id: `sponsor-${Date.now()}`,
      ownerWallet: address,
      topic: topic.trim(),
      description: description.trim(),
      type,
      winnerCount: winners,
      maxParticipants: max,
      rewardType,
      rewardAmount:
        rewardType !== "fun"
          ? rewardAmount.trim()
          : undefined,
      rewardCurrency:
        rewardType !== "fun"
          ? rewardCurrency
              .trim()
              .toUpperCase()
          : undefined,
      rewardLabel:
        rewardType === "other"
          ? rewardLabel.trim()
          : undefined,
      participantsJoined:
        type === "manual"
          ? selected.length
          : 0,
      selectedParticipants: selected,
      expiresAt: expiry,
      communityLinks:
        type === "link"
          ? community
              .split(/\n+/)
              .map((value) =>
                value.trim(),
              )
              .filter(Boolean)
              .map((value) => ({
                label:
                  value
                    .split("|")[0]
                    ?.trim() ||
                  "Community",
                url: value
                  .split("|")
                  .slice(1)
                  .join("|")
                  .trim(),
              }))
              .filter(
                (value) => value.url,
              )
          : [],
      createdAt: Date.now(),
      status: "draft",
    };

    const next = [
      campaign,
      ...campaigns,
    ];

    saveSponsorCampaigns(
      address,
      next,
    );

    setCampaigns(next);

    resetForm();

    setMessage(
      "Sponsor Prolly saved as a draft. Publish it to create the real Prolly on GenLayer.",
    );
  }

  async function publish(
    campaignId: string,
  ) {
    if (!address) {
      setMessage(
        "Connect your sponsor wallet first.",
      );
      return;
    }

    const campaign = campaigns.find(
      (item) => item.id === campaignId,
    );

    if (!campaign) return;

    if (campaign.status !== "draft") {
      setMessage(
        "This Sponsor Prolly has already been published.",
      );
      return;
    }

    if (
      campaign.type === "link" &&
      !campaign.expiresAt
    ) {
      setMessage(
        "This Link Prolly has no expiration.",
      );
      return;
    }

    setBusyCampaignId(campaignId);
    setMessage(
      "Creating the Sponsor Prolly on GenLayer. Confirm the sponsor fee in your wallet...",
    );

    try {
      const accessToken =
        campaign.type === "link"
          ? campaign.accessToken ??
            makeToken()
          : "";

      const lifetimeSeconds =
        campaign.type === "link" &&
        campaign.expiresAt
          ? BigInt(
              Math.max(
                1,
                Math.round(
                  (campaign.expiresAt -
                    Date.now()) /
                    1000,
                ),
              ),
            )
          : 0n;

      if (
        campaign.type === "link" &&
        lifetimeSeconds <= 0n
      ) {
        throw new Error(
          "This Sponsor Link Prolly has already expired. Create a new draft.",
        );
      }

      const participantCsv =
        campaign.type === "manual"
          ? campaign.selectedParticipants
              .map(
                (participant) =>
                  participant.walletAddress.trim(),
              )
              .join(",")
          : "";

      if (
        campaign.type === "manual" &&
        !participantCsv
      ) {
        throw new Error(
          "Manual Prolly requires participant wallet addresses.",
        );
      }

      const result =
        await createSponsorProlly({
          account: address,
          name: campaign.topic,
          description:
            campaign.description,
          mode: campaign.type,
          rewardType:
            campaign.rewardType,
          rewardLabel:
            campaign.rewardLabel ?? "",
          rewardAmount:
            campaign.rewardAmount ?? "",
          rewardCurrency:
            campaign.rewardCurrency ?? "",
          maxParticipants:
            BigInt(
              campaign.maxParticipants,
            ),
          winnerCount:
            BigInt(
              campaign.winnerCount,
            ),
          lifetimeSeconds,
          accessToken,
          participantCsv,
        });

      const publishedCampaign: SponsorCampaign =
        {
          ...campaign,
          status: "published",
          accessToken:
            campaign.type === "link"
              ? accessToken
              : undefined,
          onChainId:
            result.prollyId.toString(),
        };

      const next = campaigns.map(
        (item) =>
          item.id === campaignId
            ? publishedCampaign
            : item,
      );

      saveSponsorCampaigns(
        address,
        next,
      );

      setCampaigns(next);

      setMessage(
        `Published successfully. GenLayer Prolly #${result.prollyId.toString()} is now on-chain.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      setBusyCampaignId(null);
    }
  }

  function remove(id: string) {
    if (!address) return;

    removeSponsorCampaign(
      address,
      id,
    );

    setCampaigns(
      campaigns.filter(
        (campaign) =>
          campaign.id !== id,
      ),
    );
  }

  if (!approved) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:p-8">
        <div className="mx-auto max-w-2xl pt-20">
          <p className="text-sm uppercase tracking-widest text-violet-400">
            Sponsor Dashboard
          </p>

          <h1 className="mt-4 text-3xl font-bold">
            Sponsor access required
          </h1>

          <p className="mt-4 text-zinc-400">
            Only an approved sponsor wallet can
            manage Sponsor Prollys.
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
          <Link
            href="/"
            className="text-2xl font-bold"
          >
            PROLLY
            <span className="text-violet-400">
              .
            </span>
          </Link>

          <div className="flex gap-3">
            <WorkspaceSwitcher />

            <Link
              href="/prollys"
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm"
            >
              Explore
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm uppercase tracking-widest text-violet-400">
          Sponsor Workspace
        </p>

        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
          Create a Sponsor Prolly.
        </h1>

        <p className="mt-4 max-w-3xl text-zinc-400">
          Sponsors have exactly two formats:
          Link Prolly and Manual Prolly. The
          sponsor pays the on-chain creation fee.
          Participant rewards remain off-chain and
          are paid directly by the sponsor.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7">
            <h2 className="text-2xl font-semibold">
              Prolly setup
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {(
                ["link", "manual"] as const
              ).map((value) => (
                <button
                  key={value}
                  onClick={() =>
                    setType(value)
                  }
                  className={`rounded-2xl border p-4 text-left ${
                    type === value
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-zinc-700"
                  }`}
                >
                  <b>
                    {value === "link"
                      ? "Link Prolly"
                      : "Manual Prolly"}
                  </b>

                  <p className="mt-1 text-xs text-zinc-500">
                    {value === "link"
                      ? "Private link distributed by the sponsor."
                      : "Sponsor supplies the participant wallet list."}
                  </p>
                </button>
              ))}
            </div>

            <label className="mt-6 block text-sm">
              Topic
            </label>

            <input
              value={topic}
              onChange={(e) =>
                setTopic(e.target.value)
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
            />

            <label className="mt-5 block text-sm">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value,
                )
              }
              rows={4}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm">
                  Winner count
                </label>

                <input
                  type="number"
                  min="1"
                  value={winnerCount}
                  onChange={(e) =>
                    setWinnerCount(
                      e.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                />
              </div>

              <div>
                <label className="text-sm">
                  Maximum participants
                </label>

                <input
                  type="number"
                  min="1"
                  value={maxParticipants}
                  onChange={(e) =>
                    setMaxParticipants(
                      e.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                />
              </div>
            </div>

            <label className="mt-5 block text-sm">
              Winner reward
            </label>

            <select
              value={rewardType}
              onChange={(e) =>
                setRewardType(
                  e.target
                    .value as SponsorRewardType,
                )
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
            >
              <option value="xp">
                XP reward
              </option>
              <option value="crypto">
                Crypto reward
              </option>
              <option value="fun">
                Just for fun
              </option>
              <option value="other">
                Other
              </option>
            </select>

            {rewardType !== "fun" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                <input
                  inputMode="decimal"
                  value={rewardAmount}
                  onChange={(e) =>
                    setRewardAmount(
                      e.target.value,
                    )
                  }
                  placeholder="Reward amount per winner"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                />

                <input
                  value={rewardCurrency}
                  onChange={(e) =>
                    setRewardCurrency(
                      e.target.value,
                    )
                  }
                  placeholder="Currency / unit (e.g. NGN, USD, XP)"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                />
              </div>
            )}

            {rewardType !== "fun" && (
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                This reward is paid directly by the
                sponsor to each winner. It is not
                deposited into the Sponsor Prolly
                contract.
              </p>
            )}

            {rewardType === "other" && (
              <input
                value={rewardLabel}
                onChange={(e) =>
                  setRewardLabel(
                    e.target.value,
                  )
                }
                placeholder="Describe the winner reward"
                className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
              />
            )}

            {type === "link" ? (
              <>
                <label className="mt-5 block text-sm">
                  Access link expires
                </label>

                <select
                  value={expiresAt}
                  onChange={(e) =>
                    setExpiresAt(
                      e.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                >
                  <option value="">
                    Select expiration
                  </option>
                  <option value="15">
                    15 minutes
                  </option>
                  <option value="30">
                    30 minutes
                  </option>
                  <option value="45">
                    45 minutes
                  </option>
                  <option value="60">
                    1 hour
                  </option>
                </select>

                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  The expiration is recorded in
                  GenLayer when the Sponsor Prolly
                  is created.
                </p>

                <label className="mt-5 block text-sm">
                  Community / contact links
                </label>

                <textarea
                  value={community}
                  onChange={(e) =>
                    setCommunity(
                      e.target.value,
                    )
                  }
                  rows={4}
                  placeholder={
                    "Telegram | https://t.me/yourcommunity\nDiscord | https://discord.gg/yourcommunity\nX | https://x.com/yourpost"
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                />

                <p className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs leading-5 text-zinc-500">
                  These links can be used to
                  distribute the private Sponsor
                  access link. The actual Prolly
                  participant state is stored on-chain.
                </p>
              </>
            ) : (
              <>
                <label className="mt-5 block text-sm">
                  Selected participants
                </label>

                <p className="mt-2 text-xs text-zinc-500">
                  Enter one wallet address per box.
                  The wallet address is the
                  authoritative identity used by
                  GenLayer.
                </p>

                <div className="mt-4 space-y-3">
                  {participants.map(
                    (
                      participant,
                      index,
                    ) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 p-3"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
                          {index + 1}
                        </div>

                        <input
                          value={
                            participant.walletAddress
                          }
                          onChange={(e) =>
                            updateParticipant(
                              index,
                              e.target.value,
                            )
                          }
                          placeholder="0x wallet address"
                          className="min-w-0 flex-1 bg-transparent p-2 outline-none"
                        />

                        {participants.length >
                          1 && (
                          <button
                            type="button"
                            onClick={() =>
                              removeParticipant(
                                index,
                              )
                            }
                            className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-300"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={
                      addParticipant
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-500/40 bg-violet-500/5 p-4 font-semibold text-violet-300 hover:bg-violet-500/10"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-black">
                      +
                    </span>
                    Add more participant
                  </button>

                  <p className="text-xs text-zinc-600">
                    Current boxes:{" "}
                    {participants.length} ·
                    Required:{" "}
                    {maxParticipants}
                  </p>
                </div>
              </>
            )}

            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <b className="text-emerald-300">
                Sponsor-paid rewards
              </b>

              <p className="mt-1 text-xs text-zinc-500">
                Sponsor rewards are informational
                and off-chain. The Sponsor Prolly
                contract does not hold or distribute
                those rewards.
              </p>
            </div>

            <button
              onClick={createCampaign}
              className="mt-6 w-full rounded-full bg-violet-500 py-3 font-semibold"
            >
              Save Sponsor Prolly
            </button>

            {message && (
              <p className="mt-4 text-sm text-zinc-400">
                {message}
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-7">
            <h2 className="text-2xl font-semibold">
              Your Sponsor Prollys
            </h2>

            {campaigns.length === 0 ? (
              <p className="mt-6 text-zinc-500">
                No Sponsor Prollys yet.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {campaigns.map(
                  (campaign) => (
                    <article
                      key={campaign.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5"
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-violet-400">
                            {campaign.type ===
                            "link"
                              ? "Link Prolly"
                              : "Manual Prolly"}
                          </p>

                          <h3 className="mt-2 text-xl font-bold">
                            {campaign.topic}
                          </h3>
                        </div>

                        <span className="text-xs text-zinc-500">
                          {campaign.status}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-zinc-400">
                        {campaign.description}
                      </p>

                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <span>
                          Winners:{" "}
                          <b>
                            {
                              campaign.winnerCount
                            }
                          </b>
                        </span>

                        <span>
                          Maximum:{" "}
                          <b>
                            {
                              campaign.maxParticipants
                            }
                          </b>
                        </span>

                        <span>
                          Reward:{" "}
                          <b>
                            {campaign.rewardType ===
                            "fun"
                              ? "Just for fun"
                              : `${rewardName(
                                  campaign.rewardType,
                                  campaign.rewardLabel,
                                )} — ${
                                  campaign.rewardAmount ??
                                  "—"
                                } ${
                                  campaign.rewardCurrency ??
                                  ""
                                } per winner`}
                          </b>
                        </span>

                        {campaign.type ===
                        "link" ? (
                          <span>
                            Access expires:{" "}
                            <b>
                              {formatTime(
                                campaign.expiresAt,
                              )}
                            </b>
                          </span>
                        ) : (
                          <span>
                            Participants:{" "}
                            <b>
                              {
                                campaign
                                  .selectedParticipants
                                  .length
                              }
                              /
                              {
                                campaign.maxParticipants
                              }
                            </b>
                          </span>
                        )}
                      </div>

                      {campaign.onChainId && (
                        <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <p className="text-xs uppercase tracking-widest text-emerald-400">
                            GenLayer
                          </p>

                          <p className="mt-2 text-sm">
                            On-chain Prolly ID:{" "}
                            <b>
                              #
                              {
                                campaign.onChainId
                              }
                            </b>
                          </p>
                        </div>
                      )}

                      {campaign.type ===
                        "link" &&
                        campaign.accessToken &&
                        campaign.status ===
                          "published" &&
                        campaign.onChainId && (
                          <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                            <b className="text-cyan-300">
                              Private sponsor access link
                            </b>

                            <p className="mt-2 break-all text-xs text-zinc-400">
                              {typeof window !==
                              "undefined"
                                ? window.location
                                    .origin
                                : ""}
                              /sponsor/campaign/
                              {
                                campaign.onChainId
                              }
                              ?token=
                              {
                                campaign.accessToken
                              }
                            </p>

                            <p className="mt-2 text-xs text-zinc-500">
                              Anyone with this private
                              link can attempt to join
                              until the on-chain access
                              expiry or participant cap
                              is reached.
                            </p>

                            <button
                              onClick={() => {
                                const link =
                                  window.location
                                    .origin +
                                  "/sponsor/campaign/" +
                                  campaign.onChainId +
                                  "?token=" +
                                  campaign.accessToken;

                                void navigator
                                  .clipboard
                                  ?.writeText(
                                    link,
                                  );

                                setMessage(
                                  "Private access link copied.",
                                );
                              }}
                              className="mt-3 rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-black"
                            >
                              Copy Access Link
                            </button>
                          </div>
                        )}

                      {campaign.type ===
                        "link" &&
                        campaign.communityLinks
                          .length >
                          0 && (
                          <div className="mt-4 text-xs text-zinc-500">
                            Community:{" "}
                            {campaign.communityLinks.map(
                              (
                                link,
                                index,
                              ) => (
                                <a
                                  key={index}
                                  href={
                                    link.url
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ml-2 text-cyan-300"
                                >
                                  {
                                    link.label
                                  }
                                </a>
                              ),
                            )}
                          </div>
                        )}

                      {campaign.type ===
                        "manual" && (
                        <div className="mt-4 space-y-2">
                          {campaign.selectedParticipants.map(
                            (
                              participant,
                              index,
                            ) => (
                              <div
                                key={index}
                                className="rounded-xl bg-zinc-900 px-3 py-2 text-sm"
                              >
                                {
                                  participant.walletAddress
                                }
                              </div>
                            ),
                          )}
                        </div>
                      )}

                      <div className="mt-5 flex gap-3">
                        {campaign.status ===
                          "draft" && (
                          <button
                            onClick={() =>
                              void publish(
                                campaign.id,
                              )
                            }
                            disabled={
                              busyCampaignId ===
                              campaign.id
                            }
                            className="flex-1 rounded-full bg-emerald-400 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busyCampaignId ===
                            campaign.id
                              ? "Publishing on GenLayer..."
                              : "Publish Prolly"}
                          </button>
                        )}

                        <button
                          onClick={() =>
                            remove(
                              campaign.id,
                            )
                          }
                          disabled={
                            busyCampaignId ===
                            campaign.id
                          }
                          className="rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
