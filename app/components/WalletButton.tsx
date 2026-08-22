"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
} from "wagmi";

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const metaMaskConnector = connectors.find(
    (connector) => connector.id === "metaMask"
  );

  function handleConnect() {
    if (!metaMaskConnector) {
      alert(
        "MetaMask connector is not available. Please make sure MetaMask is installed."
      );
      return;
    }

    connect({ connector: metaMaskConnector });
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

  return (
    <button
      onClick={handleConnect}
      disabled={isPending}
      className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
