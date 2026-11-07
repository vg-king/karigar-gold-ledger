const MG_PER_GRAM = 1000n;
const BASIS_POINTS = 10000n;

export type LedgerEntry =
  | { type: "ISSUE"; fineMg: bigint }
  | { type: "RECEIPT_PIECE" | "RECEIPT_SCRAP" | "RECEIPT_FILINGS"; fineMg: bigint };

function assertNonNegativeInteger(value: bigint, name: string): void {
  if (value < 0n) {
    throw new RangeError(`${name} must not be negative`);
  }
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function parseDecimal(
  value: string,
  maxDecimals: number,
  name: string,
): { whole: bigint; fraction: bigint; scale: bigint } {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty decimal string`);
  }

  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError(`${name} must be a non-negative decimal string`);
  }

  const [wholePart, fractionPart = ""] = value.split(".");
  if (fractionPart.length > maxDecimals) {
    throw new RangeError(`${name} has too many decimal places`);
  }

  const scale = 10n ** BigInt(maxDecimals);
  const fraction = BigInt(fractionPart.padEnd(maxDecimals, "0") || "0");
  return { whole: BigInt(wholePart), fraction, scale };
}

export function parseWeightToMg(value: string): bigint {
  const parsed = parseDecimal(value, 3, "Weight");
  return parsed.whole * MG_PER_GRAM + (parsed.fraction * MG_PER_GRAM) / parsed.scale;
}

export function parsePurityToBp(value: string): bigint {
  const parsed = parseDecimal(value, 2, "Purity");
  const basisPoints = parsed.whole * 100n + parsed.fraction;
  if (basisPoints > BASIS_POINTS) {
    throw new RangeError("Purity must be between 0 and 100");
  }
  return basisPoints;
}

export function formatMg(value: bigint): string {
  assertNonNegativeInteger(value, "Weight");
  return formatSignedMg(value);
}

export function formatSignedMg(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  const whole = absolute / MG_PER_GRAM;
  const fraction = (absolute % MG_PER_GRAM).toString().padStart(3, "0");
  return `${value < 0n ? "-" : ""}${whole}.${fraction}`;
}

export function fineMg(grossMg: bigint, purityBp: bigint): bigint {
  assertNonNegativeInteger(grossMg, "Gross weight");
  if (purityBp < 0n || purityBp > BASIS_POINTS) {
    throw new RangeError("Purity must be between 0 and 10000 basis points");
  }
  return roundHalfUp(grossMg * purityBp, BASIS_POINTS);
}

export function allowedWastageMg(issuedFineMg: bigint, wastageBp: bigint): bigint {
  assertNonNegativeInteger(issuedFineMg, "Issued fine weight");
  if (wastageBp < 0n || wastageBp > BASIS_POINTS) {
    throw new RangeError("Wastage must be between 0 and 10000 basis points");
  }

  return roundHalfUp(issuedFineMg * wastageBp, BASIS_POINTS);
}

// Assumption: lossBp is a rounded, integer-only loss rate for a closed job.
export function lossBp(issuedFineMg: bigint, receivedFineMg: bigint): bigint {
  assertNonNegativeInteger(issuedFineMg, "Issued fine weight");
  assertNonNegativeInteger(receivedFineMg, "Received fine weight");
  if (issuedFineMg === 0n) return 0n;
  return roundHalfUp((issuedFineMg - receivedFineMg) * BASIS_POINTS, issuedFineMg);
}

export function runningBalanceMg(entries: LedgerEntry[]): bigint {
  return entries.reduce((balance, entry) => {
    assertNonNegativeInteger(entry.fineMg, "Entry fine weight");
    return entry.type === "ISSUE"
      ? balance + entry.fineMg
      : balance - entry.fineMg;
  }, 0n);
}

export function lossBeyondAllowanceMg(balanceMg: bigint, allowedMg: bigint): bigint {
  // API-level validation blocks negative balances separately.
  if (balanceMg < 0n) {
    return 0n;
  }
  assertNonNegativeInteger(allowedMg, "Allowance");
  return balanceMg > allowedMg ? balanceMg - allowedMg : 0n;
}
