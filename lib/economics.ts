export const GEN_DECIMALS = 18;

export type ProllyEconomics = {
  entryFee: bigint;
  participants: bigint;
  maxParticipants: bigint;
  winnerCount: bigint;
  currentPool: bigint;
  maxPool: bigint;
  currentWinProbabilityBps: bigint;
  maxWinProbabilityBps: bigint;
};

export function calculateProllyEconomics(
  entryFee: bigint,
  participants: bigint,
  maxParticipants: bigint,
  winnerCount: bigint,
): ProllyEconomics {
  const currentPool = entryFee * participants;
  const maxPool = entryFee * maxParticipants;

  const currentWinProbabilityBps =
    participants > 0n
      ? (winnerCount * 10000n) / participants
      : 0n;

  const maxWinProbabilityBps =
    maxParticipants > 0n
      ? (winnerCount * 10000n) / maxParticipants
      : 0n;

  return {
    entryFee,
    participants,
    maxParticipants,
    winnerCount,
    currentPool,
    maxPool,
    currentWinProbabilityBps,
    maxWinProbabilityBps,
  };
}

export function formatGenAmount(value: bigint): string {
  const whole = value / 1000000000000000000n;
  const fraction = value % 1000000000000000000n;

  if (fraction === 0n) return whole.toString();

  return (
    whole.toString() +
    "." +
    fraction.toString().padStart(18, "0").replace(/0+$/, "")
  );
}

export function formatBpsAsPercent(bps: bigint): string {
  const whole = bps / 100n;
  const fraction = bps % 100n;

  if (fraction === 0n) return whole.toString() + "%";

  return whole.toString() + "." + fraction.toString().padStart(2, "0") + "%";
}
