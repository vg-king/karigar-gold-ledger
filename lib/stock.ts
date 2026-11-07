import { formatMg, formatSignedMg } from "./gold";
import { calculateKarigarBalanceMg } from "./ledger-service";

export type StockMovementInput = {
  type: "OPENING" | "REFINER_SEND" | "REFINER_RETURN";
  movementDate: Date;
  fineMg: bigint;
  note: string;
};

export type StockEntry = {
  type: "ISSUE" | "RECEIPT_PIECE" | "RECEIPT_SCRAP" | "RECEIPT_FILINGS";
  fineMg: bigint;
  createdAt: Date;
  jobId: string;
  karigarId: string;
};

export type StockJob = {
  id: string;
  jobNo: string;
  karigarId: string;
  createdAt: Date;
  closedAt: Date | null;
  ledgerEntries: StockEntry[];
};

export type StockStatement = {
  date: string;
  openingMg: bigint;
  vaultMg: bigint;
  withKarigarsMg: bigint;
  atRefinerMg: bigint;
  writtenOffMg: bigint;
  reconciliationDifferenceMg: bigint;
  reconciled: boolean;
  warning: string | null;
  karigars: Array<{ karigarId: string; karigarName: string; fineMg: bigint }>;
};

function endOfDate(date: Date): Date {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function signedEntryTotal(entries: StockEntry[], end: Date): bigint {
  return entries.filter((entry) => entry.createdAt <= end).reduce(
    (sum, entry) => sum + (entry.type === "ISSUE" ? entry.fineMg : -entry.fineMg),
    0n,
  );
}

export function calculateStockStatement(
  movements: StockMovementInput[],
  entries: StockEntry[],
  jobs: Array<StockJob & { karigarName: string }>,
  date: Date,
): StockStatement {
  // A-S1: report all fine gold at vault, with karigars, at refiner, or written off.
  // A-S2/A-S3: movements and ledger entries are integer milligrams; no float arithmetic is used.
  const end = endOfDate(date);
  const asOfMovements = movements.filter((movement) => movement.movementDate <= end);
  const openingMg = asOfMovements.filter((movement) => movement.type === "OPENING").reduce((sum, movement) => sum + movement.fineMg, 0n);
  const sends = asOfMovements.filter((movement) => movement.type === "REFINER_SEND").reduce((sum, movement) => sum + movement.fineMg, 0n);
  const returns = asOfMovements.filter((movement) => movement.type === "REFINER_RETURN").reduce((sum, movement) => sum + movement.fineMg, 0n);
  const asOfJobs = jobs.filter((job) => job.createdAt <= end);
  const asOfEntries = entries.filter((entry) => entry.createdAt <= end);
  const issueReceiptNet = signedEntryTotal(asOfEntries, end);
  const openJobs = asOfJobs.filter((job) => !job.closedAt || job.closedAt > end);
  const closedJobs = asOfJobs.filter((job) => job.closedAt !== null && job.closedAt <= end);
  const balance = (job: StockJob) => signedEntryTotal(job.ledgerEntries, end);
  const withKarigarsById = new Map<string, { name: string; fineMg: bigint }>();
  for (const job of openJobs) {
    const current = withKarigarsById.get(job.karigarId) ?? { name: (job as StockJob & { karigarName: string }).karigarName, fineMg: 0n };
    current.fineMg += calculateKarigarBalanceMg([{
      status: "OPEN",
      createdAt: job.createdAt,
      closedAt: null,
      ledgerEntries: [...job.ledgerEntries],
    }], date);
    withKarigarsById.set(job.karigarId, current);
  }
  const withKarigarsMg = [...withKarigarsById.values()].reduce((sum, item) => sum + item.fineMg, 0n);
  const writtenOffMg = closedJobs.reduce((sum, job) => sum + balance(job), 0n);
  const atRefinerMg = sends - returns;
  const vaultMg = openingMg - issueReceiptNet - sends + returns;
  const reconciliationDifferenceMg = vaultMg + withKarigarsMg + atRefinerMg + writtenOffMg - openingMg;
  return {
    date: date.toISOString().slice(0, 10),
    openingMg,
    vaultMg,
    withKarigarsMg,
    atRefinerMg,
    writtenOffMg,
    reconciliationDifferenceMg,
    reconciled: reconciliationDifferenceMg === 0n,
    warning: vaultMg < 0n
      ? `Vault stock is negative by ${formatMg(-vaultMg)} g.`
      : reconciliationDifferenceMg === 0n ? null : `Stock does not reconcile; difference is ${formatMg(reconciliationDifferenceMg < 0n ? -reconciliationDifferenceMg : reconciliationDifferenceMg)} g.`,
    karigars: [...withKarigarsById.entries()]
      .map(([karigarId, item]) => ({ karigarId, karigarName: item.name, fineMg: item.fineMg }))
      .sort((left, right) => left.karigarName.localeCompare(right.karigarName)),
  };
}

export function serializeStockStatement(statement: StockStatement) {
  return {
    date: statement.date,
    opening: { mg: statement.openingMg.toString(), grams: formatMg(statement.openingMg) },
    vault: { mg: statement.vaultMg.toString(), grams: formatSignedMg(statement.vaultMg) },
    withKarigars: { mg: statement.withKarigarsMg.toString(), grams: formatMg(statement.withKarigarsMg) },
    atRefiner: { mg: statement.atRefinerMg.toString(), grams: formatMg(statement.atRefinerMg) },
    writtenOff: { mg: statement.writtenOffMg.toString(), grams: formatMg(statement.writtenOffMg) },
    reconciliationDifference: { mg: statement.reconciliationDifferenceMg.toString(), grams: formatMg(statement.reconciliationDifferenceMg < 0n ? -statement.reconciliationDifferenceMg : statement.reconciliationDifferenceMg) },
    reconciled: statement.reconciled,
    warning: statement.warning,
    karigars: statement.karigars.map((item) => ({ ...item, fineMg: item.fineMg.toString(), grams: formatMg(item.fineMg) })),
  };
}

export function parseStockDate(value: string | null | undefined): Date {
  const date = value ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must use YYYY-MM-DD.");
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Date must use YYYY-MM-DD.");
  return parsed;
}

export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function isFutureStockDate(value: string): boolean {
  return value > todayInIndia();
}
