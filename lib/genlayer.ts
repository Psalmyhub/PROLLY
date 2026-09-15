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
  "0x87102f492563B66EF1357aE700ec295ba7bD7ae3" as Address;

export const PROLLY_CONTRACT_OWNER =
  (process.env.NEXT_PUBLIC_PROLLY_CONTRACT_OWNER ||
    "0x285998b2176a9d4eC471DF738554e81b14d34216") as Address;
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
};

type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function getProvider(): Eip1193Provider {
  if (typeof window === "undefined") {
    throw new Error("Wallet is only available in the browser.");
  }

  const provider = (window as any).ethereum;

  if (!provider) {
    throw new Error("No Ethereum wallet was found.");
  }

  if (typeof provider.request !== "function") {
    throw new Error("Connected wallet provider is invalid.");
  }

  return provider as Eip1193Provider;
}

/*
 * READ CLIENT
 *
 * Reads do not need a wallet or injected provider.
 * GenLayer's readContract API supports account-free reads.
 */
function getReadClient() {
  return createClient({
    chain: studionet,
  });
}

/*
 * WRITE CLIENT
 *
 * Writes need the connected browser wallet.
 */
async function getWriteClient(account: Address) {
  const provider = getProvider();
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as unknown;
  const connectedAccounts = Array.isArray(accounts)
    ? accounts.map(String)
    : [];

  if (!connectedAccounts.some((item) => item.toLowerCase() === account.toLowerCase())) {
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

async function waitForTransaction(hash: string): Promise<GenLayerTransaction> {
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

  if (execution && execution !== ExecutionResult.FINISHED_WITH_RETURN) {
    throw new Error(`GenLayer transaction did not finish successfully: ${execution}.`);
  }

  return receipt;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractReceiptError(receipt: GenLayerTransaction): string {
  const leaders = receipt.consensus_data?.leader_receipt ?? [];
  const first = leaders[0];
  return first?.error || first?.result || "unknown execution error";
}

function requireContractOwner(account: Address): void {
  if (account.toLowerCase() !== PROLLY_CONTRACT_OWNER.toLowerCase()) {
    throw new Error(
      `Only the deployed contract owner (${PROLLY_CONTRACT_OWNER}) can perform this operation.`,
    );
  }
}

export function isContractOwner(account: Address | undefined): boolean {
  return Boolean(
    account && account.toLowerCase() === PROLLY_CONTRACT_OWNER.toLowerCase(),
  );
}

/*
 * The contract does NOT expose get_next_prolly_id().
 *
 * IDs are sequential and get_name(id) returns an empty string
 * when that ID does not exist, so we determine the next ID by
 * scanning until the first unused ID.
 */
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

function extractReturnedId(receipt: GenLayerTransaction): bigint | null {
  const result = receipt.consensus_data?.leader_receipt?.[0]?.result;
  if (!result) return null;

  const match = String(result).match(/(?:payload|result|return_data)[^0-9]*([0-9]+)/i);
  if (!match) return null;

  try {
    return BigInt(match[1]);
  } catch {
    return null;
  }
}

async function findCreatedProllyId(name: string): Promise<bigint | null> {
  for (let id = 1n; id <= 10000n; id++) {
    if ((await getName(id)) === name) return id;
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
  /*
   * Determine the ID before creation because the contract increments
   * its internal next_prolly_id after creating the Prolly.
   */
  requireContractOwner(account);
  const client = await getWriteClient(account);

  const hash = await client.writeContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "create_prolly",
    args: [name, entryFee, maxParticipants, winnerCount],
    value: 0n,
  });

  const receipt = await waitForTransaction(String(hash));
  const returnedId = extractReturnedId(receipt);
  const prollyId = returnedId ?? (await findCreatedProllyId(name));

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
    const [
      name,
      entryFee,
      maxParticipants,
      winnerCount,
      participantCount,
      closed,
      winnersFinalized,
      randomSeed,
    ] = await Promise.all([
      getName(id),
      getEntryFee(id),
      getMaxParticipants(id),
      getWinnerCount(id),
      getParticipantCount(id),
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
    };
  } catch (error) {
    console.error(
      `Failed to load on-chain Prolly ${id.toString()}:`,
      error,
    );

    return null;
  }
}

export async function getAllOnChainProllys(): Promise<OnChainProlly[]> {
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
