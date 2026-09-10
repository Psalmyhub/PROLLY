import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";

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

export const wagmiConfig = createConfig({
  chains: [genlayerStudio],

  connectors: [
    injected({
      shimDisconnect: true,
    }),

    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
          }),
        ]
      : []),
  ],

  transports: {
    [genlayerStudio.id]: http("https://studio.genlayer.com/api"),
  },
});
