/**
 * Single shared definition of what "the same wallet" means across the
 * app. Every store that keys data by wallet address (profile, favorites,
 * Prolly participation, role resolution) should normalize through this
 * function so two different callers never disagree on identity because
 * of casing.
 *
 * NOTE: this is a client-side normalization convenience only. It does not
 * verify wallet ownership (no signature challenge) — see
 * P0_IMPLEMENTATION_PLAN.md P0-2 "Security implications" for why that's
 * an acceptable/expected boundary here, and P0-4 for where the real
 * ownership check eventually lives (the connected wallet signing an
 * actual contract transaction).
 */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}
