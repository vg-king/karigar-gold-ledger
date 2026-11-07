import { formatMg } from "./gold";

export function formatGoldForDisplay(mg: string | bigint | number): string {
  const value = typeof mg === "bigint" ? mg : BigInt(mg);
  if (value < 0n) throw new RangeError("Gold display value must not be negative");
  return formatMg(value);
}

export function formatBasisPoints(bp: number): string {
  const whole = Math.floor(bp / 100);
  const decimals = String(bp % 100).padStart(2, "0");
  return `${whole}.${decimals}`;
}
