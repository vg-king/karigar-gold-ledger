import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { ApiError } from "./api";
import { parseWeightToMg, formatMg } from "./gold";
import { calculateStockStatement, parseStockDate, serializeStockStatement, type StockStatement } from "./stock";

type StockDb = PrismaClient | Prisma.TransactionClient;

export async function getStockStatement(db: StockDb, dateValue?: string | null) {
  const date = parseStockDate(dateValue);
  const [movements, entries, jobs] = await Promise.all([
    db.stockMovement.findMany({ orderBy: { movementDate: "asc" } }),
    db.ledgerEntry.findMany({ select: { type: true, fineMg: true, createdAt: true, jobId: true, karigarId: true } }),
    db.job.findMany({
      include: { karigar: { select: { name: true } }, ledgerEntries: { select: { type: true, fineMg: true, createdAt: true, jobId: true, karigarId: true } } },
    }),
  ]);
  const statement = calculateStockStatement(
    movements.map((movement) => ({ type: movement.type, movementDate: movement.movementDate, fineMg: movement.fineMg, note: movement.note })),
    entries,
    jobs.map((job) => ({ ...job, karigarName: job.karigar.name })),
    date,
  );
  return serializeStockStatement(statement);
}

function sameMovement(existing: { type: string; movementDate: Date; fineMg: bigint; note: string }, input: { type: string; movementDate: Date; fineMg: bigint; note: string }) {
  return existing.type === input.type
    && existing.movementDate.getTime() === input.movementDate.getTime()
    && existing.fineMg === input.fineMg
    && existing.note === input.note;
}

export async function createStockMovement(db: PrismaClient, actorId: string, input: {
  type: "REFINER_SEND" | "REFINER_RETURN";
  date: string;
  weight: string;
  note: string;
  idempotencyKey: string;
}) {
  const fineMg = parseWeightToMg(input.weight);
  const movementDate = parseStockDate(input.date);
  if (movementDate > new Date(new Date().toISOString().slice(0, 10))) {
    throw new ApiError("INVALID_INPUT", "Movement date cannot be in the future.", 422, "date");
  }
  return db.$transaction(async (tx) => {
    const duplicate = await tx.stockMovement.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    const payload = { type: input.type, movementDate, fineMg, note: input.note };
    if (duplicate) {
      if (!sameMovement(duplicate, payload)) {
        throw new ApiError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different payload.", 409);
      }
      return { status: 200, movement: duplicate };
    }
    const statement = await getStockStatement(tx, input.date);
    const vaultMg = BigInt(statement.vault.mg);
    const refinerMg = BigInt(statement.atRefiner.mg);
    if (input.type === "REFINER_SEND" && fineMg > vaultMg) {
      throw new ApiError("INSUFFICIENT_VAULT_STOCK", "Refiner send cannot exceed vault stock.", 409);
    }
    if (input.type === "REFINER_RETURN" && fineMg > refinerMg) {
      throw new ApiError("INSUFFICIENT_REFINER_STOCK", "Refiner return cannot exceed stock at the refiner.", 409);
    }
    const movement = await tx.stockMovement.create({
      data: { ...payload, idempotencyKey: input.idempotencyKey, createdById: actorId },
    });
    await tx.auditLog.create({
      data: { action: "CREATE", entity: "STOCK_MOVEMENT", entityId: movement.id, detail: `Recorded ${input.type} of ${formatMg(fineMg)} g.`, actorId },
    });
    return { status: 201, movement };
  });
}

function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded)
    ? `"${guarded.replaceAll("\"", "\"\"")}"`
    : guarded;
}

function dateForCsv(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
}

export function buildStockCsv(statement: StockStatement): string {
  const date = dateForCsv(statement.date);
  const rows = [
    ["Date", "Voucher Type", "Ledger/Particulars", "Location", "Fine Weight (g)", "Narration"],
    [date, "STOCK", "Vault", "VAULT", formatMg(statement.vaultMg < 0n ? 0n : statement.vaultMg), "Daily fine gold stock statement"],
    [date, "STOCK", "With karigars", "WITH KARIGARS", formatMg(statement.withKarigarsMg), "Open job balances"],
    [date, "STOCK", "At refiner", "AT REFINER", formatMg(statement.atRefinerMg), "Refiner balance"],
    [date, "STOCK", "Written-off wastage", "WRITTEN-OFF WASTAGE", formatMg(statement.writtenOffMg), "Closed job loss"],
    ...statement.karigars.map((item) => [date, "STOCK", item.karigarName, "WITH KARIGARS", formatMg(item.fineMg), "Fine gold held in open jobs"]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function getStockForCsv(db: StockDb, dateValue?: string | null) {
  const date = parseStockDate(dateValue);
  const [movements, entries, jobs] = await Promise.all([
    db.stockMovement.findMany({ orderBy: { movementDate: "asc" } }),
    db.ledgerEntry.findMany({ select: { type: true, fineMg: true, createdAt: true, jobId: true, karigarId: true } }),
    db.job.findMany({ include: { karigar: { select: { name: true } }, ledgerEntries: true } }),
  ]);
  return calculateStockStatement(
    movements.map((movement) => ({ type: movement.type, movementDate: movement.movementDate, fineMg: movement.fineMg, note: movement.note })),
    entries,
    jobs.map((job) => ({ ...job, karigarName: job.karigar.name })),
    date,
  );
}
