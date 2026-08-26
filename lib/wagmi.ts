import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { metaMask, walletConnect } from "wagmi/connectors";

export const genlayerStudio = defineChain({
  id: 61999,
  name: "GenLayer Studio Network",
  nativeCurrency: {
    name: "GEN Token",
    symbol: "GEN",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://studio.genlayer.com/api"],
    },
  },
});

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local");
}

export const wagmiConfig = createConfig({
  chains: [genlayerStudio],
  connectors: [
    metaMask({
      dapp: {
        name: "Prolly",
        url: "http://localhost:3000",
      },
    }),
    walletConnect({
      projectId,
      showQrModal: true,
    }),
  ],
  transports: {
    [genlayerStudio.id]: http("https://studio.genlayer.com/api"),
  },
});
