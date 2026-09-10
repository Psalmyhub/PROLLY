"use client";

import { type Address } from "viem";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const PROLLY_CONTRACT_ADDRESS =
  "0xFAFA753b809B1293E2660086215634FA15Cd8E15" as Address;

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

function getProvider(): any {
  if (typeof window === "undefined") {
    throw new Error("Wallet is only available in the browser.");
  }

  const provider = (window as any).ethereum;

  if (!provider) {
    throw new Error("No Ethereum wallet was found.");
  }

  return provider;
}

function getClient(account?: Address) {
  return createClient({
    chain: studionet,
    ...(account ? { account } : {}),
    provider: getProvider(),
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
): Promise<void> {
  const client = getClient();

  while (true) {
    const receipt = await client.getTransactionReceipt({
      hash: hash as `0x${string}`,
    });

    if (receipt) {
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 3000),
    );
  }
}

export async function createProlly(
  account: Address,
  name: string,
  entryFee: bigint,
  maxParticipants: bigint,
  winnerCount: bigint,
): Promise<{
  prollyId: bigint;
  hash: string;
}> {
  const client = getClient(account);

  /*
   * The contract assigns the current next_prolly_id
   * to the new Prolly, then increments it.
   *
   * Read it before creating so the frontend knows
   * exactly which on-chain ID belongs to this transaction.
   */
  const prollyId = await getNextProllyId();

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

  await waitForTransaction(String(hash));

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
  const client = getClient(account);

  const hash = await client.writeContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "join",
    args: [BigInt(prollyId)],
    value: payment,
  });

  await waitForTransaction(String(hash));

  return String(hash);
}

export async function hasJoinedProlly(
  prollyId: bigint | string | number,
  participant: Address,
): Promise<boolean> {
  const client = getClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "has_joined",
    args: [
      BigInt(prollyId),
      participant,
    ],
  });

  return asBoolean(result);
}

export async function closeProlly(
  account: Address,
  prollyId: bigint | string | number,
) {
  const client = getClient(account);

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
  const client = getClient(account);

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
  const client = getClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_participant",
    args: [
      BigInt(prollyId),
      BigInt(index),
    ],
  });

  return asString(result) as Address;
}

export async function getParticipants(
  prollyId: bigint | string | number,
): Promise<Address[]> {
  const count = await getParticipantCount(prollyId);
  const participants: Address[] = [];

  for (let i = 0n; i < count; i++) {
    participants.push(
      await getParticipant(prollyId, i),
    );
  }

  return participants;
}

export async function getWinner(
  prollyId: bigint | string | number,
  index: bigint | string | number,
): Promise<Address> {
  const client = getClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_winner",
    args: [
      BigInt(prollyId),
      BigInt(index),
    ],
  });

  return asString(result) as Address;
}

export async function getWinners(
  prollyId: bigint | string | number,
): Promise<Address[]> {
  const count = await getWinnerCount(prollyId);
  const winners: Address[] = [];

  for (let i = 0n; i < count; i++) {
    winners.push(
      await getWinner(prollyId, i),
    );
  }

  return winners;
}

export async function getRandomSeed(
  prollyId: bigint | string | number,
): Promise<string> {
  const client = getClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_randomness_seed",
    args: [BigInt(prollyId)],
  });

  return asString(result);
}

export async function getNextProllyId(): Promise<bigint> {
  const client = getClient();

  const result = await client.readContract({
    address: PROLLY_CONTRACT_ADDRESS,
    functionName: "get_next_prolly_id",
    args: [],
  });

  return asBigInt(result);
}

export async function getName(
  prollyId: bigint | string | number,
): Promise<string> {
  const client = getClient();

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
  const client = getClient();

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
  const client = getClient();

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
  const client = getClient();

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
  const client = getClient();

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
  const client = getClient();

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
  const client = getClient();

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
  } catch {
    return null;
  }
}

export async function getAllOnChainProllys(): Promise<
  OnChainProlly[]
> {
  const nextId = await getNextProllyId();
  const result: OnChainProlly[] = [];

  for (let id = 1n; id < nextId; id++) {
    const prolly = await getOnChainProlly(id);

    if (prolly) {
      result.push(prolly);
    }
  }

  return result;
}
