"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { getRole, type UserRole } from "@/lib/role-store";
import { PROLLY_CONTRACT_OWNER } from "@/lib/genlayer";

export default function WorkspaceSwitcher() {
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<UserRole>("user");

  useEffect(() => {
    setMounted(true);
    setRole(getRole(address, PROLLY_CONTRACT_OWNER));
  }, [address]);

  if (!mounted || !address) return null;

  const isAdmin = role === "admin";
  const isSponsor = role === "sponsor";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300">
        Role: {role === "sponsor_pending" ? "Sponsor pending" : role}
      </span>

      {isAdmin && (
        <>
          <Link
            href="/admin"
            className="rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/20"
          >
            Admin workspace
          </Link>
          <Link
            href="/sponsor/dashboard"
            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20"
          >
            Sponsor workspace
          </Link>
        </>
      )}

      {isSponsor && (
        <Link
          href="/sponsor/dashboard"
          className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20"
        >
          Sponsor workspace
        </Link>
      )}
    </div>
  );
}
