"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { genlayerStudio } from "@/lib/wagmi";

export default function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    const wrongNetwork = chainId !== genlayerStudio.id;

    return (
      <div className="flex flex-col items-end gap-2">
        {wrongNetwork ? (
          <button
            type="button"
            onClick={() => switchChain({ chainId: genlayerStudio.id })}
            disabled={isSwitching}
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-5 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {isSwitching ? "Switching…" : "Switch to GenLayer"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => disconnect()}
            className="rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20"
          >
            Disconnect
          </button>
        )}

        <span className="text-xs text-white/50">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>
    );
  }

  const injectedConnector = connectors.find(
    (connector) => connector.id === "injected",
  );
  const walletConnectConnector = connectors.find(
    (connector) => connector.id === "walletConnect",
  );

  const connectWallet = async () => {
    const connector = walletConnectConnector ?? injectedConnector;

    if (!connector) {
      return;
    }

    connect({ connector });
  };

  const hasWalletConnect = Boolean(walletConnectConnector);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={connectWallet}
        disabled={isPending || (!walletConnectConnector && !injectedConnector)}
        className="rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>

      {!hasWalletConnect && (
        <span className="max-w-56 text-right text-[11px] leading-4 text-white/40">
          On mobile, open Prolly inside your wallet app if WalletConnect is not
          available.
        </span>
      )}

      {error && (
        <span className="max-w-64 text-right text-xs leading-4 text-red-300">
          {error.message}
        </span>
      )}
    </div>
  );
}
