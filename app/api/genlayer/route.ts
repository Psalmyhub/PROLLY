import { NextRequest, NextResponse } from "next/server";

const GENLAYER_RPC_URL = "https://studio.genlayer.com/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const response = await fetch(GENLAYER_RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    const responseBody = await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("GenLayer RPC proxy error:", error);

    return NextResponse.json(
      {
        error: {
          code: -32603,
          message: "Failed to reach GenLayer RPC.",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 502 },
    );
  }
}
