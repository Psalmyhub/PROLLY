"use client";

import { useEffect, useState } from "react";

import {
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";

export default function WalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (!mounted) {
    return null;
  }

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  function handleConnect(connector: (typeof connectors)[number]) {
    connect({ connector });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isPending}
            className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Connecting..." : connector.name}
          </button>
        ))}
      </div>

      {error && (
        <p className="max-w-xs text-right text-xs text-red-400">
          {error.message}
        </p>
      )}
    </div>
  );
}
