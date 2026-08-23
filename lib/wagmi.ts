import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { metaMask, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local"
  );
}

export const wagmiConfig = createConfig({
  chains: [mainnet],
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
    [mainnet.id]: http(),
  },
});
