import { NextRequest, NextResponse } from "next/server";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  ExecutionResult,
  TransactionStatus,
} from "genlayer-js/types";

const CONTRACT_ADDRESS =
  "0xFAFA753b809B1293E2660086215634FA15Cd8E15" as `0x${string}`;
const GENLAYER_RPC_URL = "https://studio.genlayer.com/api";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const relayerSecret = process.env.PROLLY_RELAYER_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const expected = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  return Boolean(
    (cronSecret && expected === cronSecret) ||
      (relayerSecret && expected === relayerSecret),
  );
}

function getRelayerAccount() {
  const privateKey = process.env.PROLLY_RELAYER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("PROLLY_RELAYER_PRIVATE_KEY is not configured.");
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("PROLLY_RELAYER_PRIVATE_KEY is invalid.");
  }

  return createAccount(privateKey as `0x${string}`);
}

function getClient() {
  return createClient({
    chain: studionet,
    endpoint: GENLAYER_RPC_URL,
    account: getRelayerAccount(),
  });
}

async function read(
  client: ReturnType<typeof getClient>,
  functionName: string,
  prollyId: bigint,
) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: [prollyId],
  });
}

async function finalizeOne(
  client: ReturnType<typeof getClient>,
  prollyId: bigint,
) {
  const closed = Boolean(await read(client, "is_closed", prollyId));
  const finalized = Boolean(
    await read(client, "are_winners_finalized", prollyId),
  );

  if (!closed || finalized) {
    return {
      prollyId: prollyId.toString(),
      action: "skipped",
      reason: finalized ? "already-finalized" : "not-closed",
    };
  }

  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "finalize_winners",
    args: [prollyId],
    value: 0n,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: 3000,
    retries: 120,
  });

  if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error(
      `Finalization failed for Prolly ${prollyId.toString()}.`,
    );
  }

  return {
    prollyId: prollyId.toString(),
    action: "finalized",
    hash: String(hash),
  };
}

async function runRelayer(request: NextRequest) {
  if (!authorized(request)) {
    return unauthorized();
  }

  try {
    const client = getClient();
    const body =
      request.method === "POST"
        ? await request.json().catch(() => ({}))
        : {};
    const requestedId = body?.prollyId;

    if (requestedId !== undefined) {
      const result = await finalizeOne(client, BigInt(String(requestedId)));
      return NextResponse.json({ ok: true, results: [result] });
    }

    const nextId = BigInt(
      String(
        await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_next_prolly_id",
          args: [],
        }),
      ),
    );

    const results: Array<{ prollyId: string; action: string; reason?: string; hash?: string }> = [];

    for (let id = 1n; id < nextId; id++) {
      try {
        results.push(await finalizeOne(client, id));
      } catch (error) {
        results.push({
          prollyId: id.toString(),
          action: "error",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    console.error("Prolly finalization relayer error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return runRelayer(request);
}

export async function POST(request: NextRequest) {
  return runRelayer(request);
}
