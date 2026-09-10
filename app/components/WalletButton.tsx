"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep the server render and the first client render identical.
  if (!mounted) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          disabled
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white/40"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20"
        >
          Disconnect
        </button>

        <span className="text-xs text-white/50">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>
    );
  }

  const connector = connectors[0];

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => {
          if (connector) {
            connect({ connector });
          }
        }}
        disabled={!connector}
        className="rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Connect Wallet
      </button>
    </div>
  );
}
