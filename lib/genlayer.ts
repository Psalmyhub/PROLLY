"use client";

import { type Address } from "viem";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  ExecutionResult,
  TransactionStatus,
} from "genlayer-js/types";
import type {
  GenLayerTransaction,
  TransactionHash,
} from "genlayer-js/types";

export const PROLLY_CONTRACT_ADDRESS =
  "0x379a8448b39926AB82DFe428F02A44cD9A2544c6" as Address;

export const PROLLY_CONTRACT_OWNER =
  (process.env.NEXT_PUBLIC_PROLLY_CONTRACT_OWNER ||
    "0xB41f7CcF919515a4741C7AAd43cFfCd56A20Ee31") as Address;

export const STUDIONET_CHAIN_ID = 61999;

export type OnChainProlly = {
  id: bigint;
  name: string;
  entryFee: bigint;
  maxParticipants: bigint;
  winnerCount: bigint;
  participantCount: bigint;
  closed: boolean;
  winnersFinalized: boolean;
  randomSeed: string;
  description: string;
  creatorRole: string;
  sponsorMode: string;
  rewardType: string;
  rewardLabel: string;
  rewardAmount: string;
  rewardCurrency: string;
  accessExpiry: bigint;
};

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type WindowWithEthereum = Window & {
  ethereum?: Eip1193Provider;
};

function getProvider(): Eip1193Provider {
  if (typeof window === "undefined") {
    throw new Error("Wallet is only available in the browser.");
  }

  const provider = (window as WindowWithEthereum).ethereum;

  if (!provider) {
    throw new Error("No Ethereum wallet was found.");
  }

  if (typeof provider.request !== "function") {
    throw new Error("Connected wallet provider is invalid.");
  }

  return provider;
}

function getReadClient() {
  const endpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/genlayer`
      : "/api/genlayer";

  return createClient({
    chain: studionet,
    endpoint,
  });
}

async function getWriteClient(account: Address) {
  const provider = getProvider();

  const accounts = await provider.request({
    method: "eth_accounts",
  });

  const connectedAccounts = Array.isArray(accounts)
    ? accounts.map(String)
    : [];

  if (
    !connectedAccounts.some(
      (item) => item.toLowerCase() === account.toLowerCase(),
    )
  ) {
    throw new Error(
      `Connected wallet account does not match the requested account (${account}). Reconnect the correct wallet.`,
    );
  }

  const chainId = String(
    await provider.request({ method: "eth_chainId" }),
  );

  const numericChainId = chainId.startsWith("0x")
    ? Number.parseInt(chainId, 16)
    : Number(chainId);

  if (numericChainId !== STUDIONET_CHAIN_ID) {
    throw new Error(
      `Wrong network. Please switch your wallet to GenLayer Studionet (chain ID ${STUDIONET_CHAIN_ID}); connected chain is ${numericChainId || chainId}.`,
    );
  }

  return createClient({
    chain: studionet,
    account,
    provider,
  });
}

function asString(value: unknown): string {
  return String(value ?? "");
}

function asBigInt(value: unknown): bigint {
  return BigInt(String(value));
}

function asBoolean(value: unknown): boolean {
  return Boolean(value);
}

async function waitForTransaction(
  hash: string,
): Promise<GenLayerTransaction> {
  const client = getReadClient();
  let receipt: GenLayerTransaction;

  try {
    receipt = await client.waitForTransactionReceipt({
      hash: hash as unknown as TransactionHash,
      status: TransactionStatus.ACCEPTED,
      interval: 3000,
      retries: 120,
    });
  } catch (error) {
    throw new Error(
      `GenLayer transaction did not reach an accepted state: ${formatError(error)}`,
    );
  }

  const execution = receipt.txExecutionResultName;
  const result = receipt.resultName;

  if (execution === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error(
      `GenLayer execution failed: ${extractReceiptError(receipt)}`,
    );
  }

  if (
    result === "MAJORITY_DISAGREE" ||
    result === "NO_MAJORITY" ||
    result === "DETERMINISTIC_VIOLATION"
  ) {
    throw new Error(`GenLayer consensus failed: ${result}.`);
  }

  if (
    execution &&
    execution !== ExecutionResult.FINISHED_WITH_RETURN
  ) {
    throw new Error(
      `GenLayer transaction did not finish successfully: ${execution}.`,
    );
  }

  return receipt;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractReceiptError(
  receipt: GenLayerTransaction,
): string {
  const leaders = receipt.consensus_data?.leader_receipt ?? [];
  const first = leaders[0];

  return first?.error || first?.result || "unknown execution error";
}

function requireContractOwner(account: Address): void {
  if (
    account.toLowerCase() !==
    PROLLY_CONTRACT_OWNER.toLowerCase()
  ) {
    throw new Error(
      `Only the deployed contract owner (${PROLLY_CONTRACT_OWNER}) can perform this operation.`,
    );
  }
}

export function isContractOwner(
  account: Address | undefined,
): boolean {
  return Boolean(
    account &&
      account.toLowerCase() ===
        PROLLY_CONTRACT_OWNER.toLowerCase(),
  );
}



export async function getSponsorFeeGen(): Promise<bigint> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_sponsor_fee_gen",
    args: [],
  });

  return asBigInt(result);
}

export async function getWalletByUsername(
  username: string,
): Promise<Address | null> {
  const client = getReadClient();
  const normalized = username.trim().replace(/^@/, "").toLowerCase();

  if (!normalized) return null;

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_wallet_by_username",
    args: [normalized],
  });

  const wallet = asString(result);
  return wallet ? (wallet as Address) : null;
}

export async function getMyProfile(
  account: Address,
): Promise<string> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_profile",
    args: [account],
  });

  return asString(result);
}

export async function registerProfile(
  account: Address,
  username: string,
): Promise<string> {
  const cleanUsername = username.trim().replace(/^@/, "");

  if (!cleanUsername) {
    throw new Error("Username is required.");
  }

  const client = await getWriteClient(account);

  const hash = await client.writeContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "register_profile",
    args: [cleanUsername],
    value: 0n,
  });

  await waitForTransaction(String(hash));
  return String(hash);
}

export type CreateSponsorProllyInput = {
  name: string;
  description: string;
  mode: "link" | "manual";
  rewardType: "xp" | "crypto" | "fun" | "other";
  rewardLabel: string;
  rewardAmount: string;
  rewardCurrency: string;
  maxParticipants: bigint;
  winnerCount: bigint;
  lifetimeSeconds: bigint;
  accessToken: string;
  participantAddresses: Address[];
  sponsorFeeGen: bigint;
};

export async function createSponsorProlly(
  account: Address,
  input: CreateSponsorProllyInput,
): Promise<{ prollyId: bigint; hash: string }> {
  const client = await getWriteClient(account);

  const hash = await client.writeContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "create_sponsor_prolly",
    args: [
      input.name,
      input.description,
      input.mode,
      input.rewardType,
      input.rewardLabel,
      input.rewardAmount,
      input.rewardCurrency,
      input.maxParticipants,
      input.winnerCount,
      input.lifetimeSeconds,
      input.accessToken,
      input.participantAddresses.join(","),
    ],
    value: input.sponsorFeeGen,
  });

  const receipt = await waitForTransaction(String(hash));
  const returnedId = extractReturnedId(receipt);

  if (returnedId === null) {
    throw new Error(
      "Sponsor publish succeeded, but the created Prolly ID could not be read from GenLayer.",
    );
  }

  return {
    prollyId: returnedId,
    hash: String(hash),
  };
}

export async function getNextProllyId(): Promise<bigint> {
  const client = getReadClient();

  for (let id = 1n; ; id++) {
    const result = await client.readContract({
      address: PROLLY_CONTRACT_ADDRESS,
      functionName: "get_name",
      args: [id],
    });

    const name = asString(result);

    if (!name) {
      return id;
    }
  }
}

function extractReturnedId(
  receipt: GenLayerTransaction,
): bigint | null {
  const result =
    receipt.consensus_data?.leader_receipt?.[0]?.result;

  if (!result) return null;

  const match = String(result).match(
    /(?:payload|result|return_data)[^0-9]*([0-9]+)/i,
  );

  if (!match) return null;

  try {
    return BigInt(match[1]);
  } catch {
    return null;
  }
}

async function findCreatedProllyId(
  name: string,
): Promise<bigint | null> {
  for (let id = 1n; id <= 10000n; id++) {
    if ((await getName(id)) === name) {
      return id;
    }
  }

  return null;
}

export async function createProlly(
  account: Address,
  name: string,
  entryFee: bigint,
  maxParticipants: bigint,
  winnerCount: bigint,
): Promise<{ prollyId: bigint; hash: string }> {
  requireContractOwner(account);

  const client = await getWriteClient(account);

  const hash = await client.writeContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "create_prolly",
    args: [
      name,
      entryFee,
      maxParticipants,
      winnerCount,
    ],
    value: 0n,
  });

  const receipt = await waitForTransaction(String(hash));
  const returnedId = extractReturnedId(receipt);

  const prollyId =
    returnedId ?? (await findCreatedProllyId(name));

  if (prollyId === null) {
    throw new Error(
      "Create transaction succeeded, but the created Prolly ID could not be read from GenLayer.",
    );
  }

  return {
    prollyId,
    hash: String(hash),
  };
}

export async function joinProlly(
  account: Address,
  prollyId: bigint | string | number,
  payment: bigint,
) {
  const client = await getWriteClient(account);

  const hash = await client.writeContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "join",
    args: [BigInt(prollyId), account],
    value: payment,
  });

  await waitForTransaction(String(hash));

  return String(hash);
}

export async function hasJoinedProlly(
  prollyId: bigint | string | number,
  participant: Address,
): Promise<boolean> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "has_joined",
    args: [BigInt(prollyId), participant],
  });

  return asBoolean(result);
}

export async function closeProlly(
  account: Address,
  prollyId: bigint | string | number,
) {
  requireContractOwner(account);

  const client = await getWriteClient(account);

  const hash = await client.writeContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "close_prolly",
    args: [BigInt(prollyId)],
    value: 0n,
  });

  await waitForTransaction(String(hash));

  return String(hash);
}

export async function finalizeWinners(
  account: Address,
  prollyId: bigint | string | number,
) {
  const client = await getWriteClient(account);

  const hash = await client.writeContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "finalize_winners",
    args: [BigInt(prollyId)],
    value: 0n,
  });

  await waitForTransaction(String(hash));

  return String(hash);
}

export async function getParticipant(
  prollyId: bigint | string | number,
  index: bigint | string | number,
): Promise<Address> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_participant",
    args: [BigInt(prollyId), BigInt(index)],
  });

  return asString(result) as Address;
}

export async function getParticipants(
  prollyId: bigint | string | number,
): Promise<Address[]> {
  const count = await getParticipantCount(prollyId);
  const participants: Address[] = [];

  for (let i = 0n; i < count; i++) {
    participants.push(await getParticipant(prollyId, i));
  }

  return participants;
}

export async function getWinner(
  prollyId: bigint | string | number,
  index: bigint | string | number,
): Promise<Address> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_winner",
    args: [BigInt(prollyId), BigInt(index)],
  });

  return asString(result) as Address;
}

export async function getWinners(
  prollyId: bigint | string | number,
): Promise<Address[]> {
  const count = await getWinnerCount(prollyId);
  const winners: Address[] = [];

  for (let i = 0n; i < count; i++) {
    winners.push(await getWinner(prollyId, i));
  }

  return winners;
}

export async function getRandomSeed(
  prollyId: bigint | string | number,
): Promise<string> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_random_seed",
    args: [BigInt(prollyId)],
  });

  return asString(result);
}

export async function getName(
  prollyId: bigint | string | number,
): Promise<string> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_name",
    args: [BigInt(prollyId)],
  });

  return asString(result);
}

export async function getEntryFee(
  prollyId: bigint | string | number,
): Promise<bigint> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_entry_fee",
    args: [BigInt(prollyId)],
  });

  return asBigInt(result);
}

export async function getMaxParticipants(
  prollyId: bigint | string | number,
): Promise<bigint> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_max_participants",
    args: [BigInt(prollyId)],
  });

  return asBigInt(result);
}

export async function getWinnerCount(
  prollyId: bigint | string | number,
): Promise<bigint> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_winner_count",
    args: [BigInt(prollyId)],
  });

  return asBigInt(result);
}

export async function getParticipantCount(
  prollyId: bigint | string | number,
): Promise<bigint> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_participant_count",
    args: [BigInt(prollyId)],
  });

  return asBigInt(result);
}

export async function isClosed(
  prollyId: bigint | string | number,
): Promise<boolean> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "is_closed",
    args: [BigInt(prollyId)],
  });

  return asBoolean(result);
}

export async function areWinnersFinalized(
  prollyId: bigint | string | number,
): Promise<boolean> {
  const client = getReadClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "are_winners_finalized",
    args: [BigInt(prollyId)],
  });

  return asBoolean(result);
}

export async function getOnChainProlly(
  prollyId: bigint | string | number,
): Promise<OnChainProlly | null> {
  const id = BigInt(prollyId);

  try {
    const client = getReadClient();
    const [
      name,
      description,
      entryFee,
      maxParticipants,
      winnerCount,
      participantCount,
      creatorRole,
      sponsorMode,
      rewardType,
      rewardLabel,
      rewardAmount,
      rewardCurrency,
      accessExpiry,
      closed,
      winnersFinalized,
      randomSeed,
    ] = await Promise.all([
      getName(id),
      client.readContract({ address: PROLLY_CONTRACT_ADDRESS, functionName: "get_description", args: [id] }).then(asString),
      getEntryFee(id),
      getMaxParticipants(id),
      getWinnerCount(id),
      getParticipantCount(id),
      client.readContract({ address: PROLLY_CONTRACT_ADDRESS, functionName: "get_creator_role", args: [id] }).then(asString),
      client.readContract({ address: PROLLY_CONTRACT_ADDRESS, functionName: "get_sponsor_mode", args: [id] }).then(asString),
      client.readContract({ address: PROLLY_CONTRACT_ADDRESS, functionName: "get_reward_type", args: [id] }).then(asString),
      client.readContract({ address: PROLLY_CONTRACT_ADDRESS, functionName: "get_reward_label", args: [id] }).then(asString),
      client.readContract({ address: PROLLY_CONTRACT_ADDRESS, functionName: "get_reward_amount", args: [id] }).then(asString),
      client.readContract({ address: PROLLY_CONTRACT_ADDRESS, functionName: "get_reward_currency", args: [id] }).then(asString),
      client.readContract({ address: PROLLY_CONTRACT_ADDRESS, functionName: "get_access_expiry", args: [id] }).then(asBigInt),
      isClosed(id),
      areWinnersFinalized(id),
      getRandomSeed(id),
    ]);

    return {
      id,
      name,
      entryFee,
      maxParticipants,
      winnerCount,
      participantCount,
      closed,
      winnersFinalized,
      randomSeed,
      description,
      creatorRole,
      sponsorMode,
      rewardType,
      rewardLabel,
      rewardAmount,
      rewardCurrency,
      accessExpiry,
    };
  } catch (error) {
    console.error(
      `Failed to load on-chain Prolly ${id.toString()}:`,
      error,
    );

    return null;
  }
}

export async function getAllOnChainProllys(): Promise<
  OnChainProlly[]
> {
  const result: OnChainProlly[] = [];

  for (let id = 1n; ; id++) {
    const name = await getName(id);

    if (!name) {
      break;
    }

    const prolly = await getOnChainProlly(id);

    if (prolly) {
      result.push(prolly);
    }
  }

  return result;
}
