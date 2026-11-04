import type { Prisma, PrismaClient } from "../generated/prisma/client";
import {
  allowedWastageMg,
  fineMg,
  parsePurityToBp,
  parseWeightToMg,
  runningBalanceMg,
  lossBeyondAllowanceMg,
} from "./gold";
import { ApiError, serializeEntry, serializeWeight } from "./api";

type Db = PrismaClient;
type Actor = { id: string };
type EntryRecord = Awaited<ReturnType<Db["ledgerEntry"]["findUnique"]>>;

function entryPayloadMatches(entry: NonNullable<EntryRecord>, payload: {
  type: string; jobId: string; grossMg: bigint; purityBp: number; netMg: bigint | null; huid?: string;
}) {
  return entry.type === payload.type
    && entry.jobId === payload.jobId
    && entry.grossMg === payload.grossMg
    && entry.purityBp === payload.purityBp
    && entry.netMg === payload.netMg
    && entry.huid === (payload.huid ?? null);
}

function entryBalance(entries: Array<{ type: string; fineMg: bigint }>): bigint {
  return runningBalanceMg(entries.map((entry) => ({
    type: entry.type as "ISSUE" | "RECEIPT_PIECE" | "RECEIPT_SCRAP" | "RECEIPT_FILINGS",
    fineMg: entry.fineMg,
  })));
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function recoverIdempotentEntry(
  db: Db,
  idempotencyKey: string,
  payload: { type: string; jobId: string; grossMg: bigint; purityBp: number; netMg: bigint | null; huid?: string },
) {
  const duplicate = await db.ledgerEntry.findUnique({ where: { idempotencyKey } });
  if (!duplicate) {
    throw new ApiError("CONFLICT", "The request conflicted with another write. Please retry.", 409);
  }
  if (!entryPayloadMatches(duplicate, payload)) {
    throw new ApiError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different payload.", 409);
  }
  return { status: 200, entry: serializeEntry(duplicate) };
}

async function audit(tx: Prisma.TransactionClient, actorId: string, action: string, entity: string, entityId: string, detail: string) {
  await tx.auditLog.create({ data: { actorId, action, entity, entityId, detail } });
}

export async function createKarigar(db: Db, actor: Actor, input: {
  name: string; nameTa?: string | null; phone: string; active?: boolean; categoryRates?: Record<string, number>;
}) {
  return db.$transaction(async (tx) => {
    const karigar = await tx.karigar.create({
      data: {
        name: input.name,
        nameTa: input.nameTa ?? null,
        phone: input.phone,
        active: input.active ?? true,
        code: `KRG-${String((await tx.karigar.count()) + 1).padStart(3, "0")}`,
      },
    });
    for (const [categoryId, wastageBp] of Object.entries(input.categoryRates ?? {})) {
      await tx.karigarCategoryRate.create({ data: { karigarId: karigar.id, categoryId, wastageBp } });
    }
    await audit(tx, actor.id, "CREATE", "KARIGAR", karigar.id, "Created karigar master record.");
    return karigar;
  });
}

export async function updateKarigar(db: Db, actor: Actor, id: string, input: {
  name?: string; nameTa?: string | null; phone?: string; active?: boolean; categoryRates?: Record<string, number>;
}) {
  return db.$transaction(async (tx) => {
    const existing = await tx.karigar.findUnique({ where: { id } });
    if (!existing) throw new ApiError("NOT_FOUND", "Karigar not found.", 404);
    const karigar = await tx.karigar.update({
      where: { id },
      data: { name: input.name, nameTa: input.nameTa, phone: input.phone, active: input.active },
    });
    for (const [categoryId, wastageBp] of Object.entries(input.categoryRates ?? {})) {
      await tx.karigarCategoryRate.upsert({
        where: { karigarId_categoryId: { karigarId: id, categoryId } },
        update: { wastageBp },
        create: { karigarId: id, categoryId, wastageBp },
      });
    }
    await audit(tx, actor.id, "UPDATE", "KARIGAR", id, "Updated karigar master record.");
    return karigar;
  });
}

export async function createIssue(db: Db, actor: Actor, input: {
  karigarId: string; categoryId: string; grossWeight: string; purity: string; huid?: string; idempotencyKey: string; jobNo?: string;
}) {
  const grossMg = parseWeightToMg(input.grossWeight);
  const purityBp = parsePurityToBp(input.purity);
  const fine = fineMg(grossMg, purityBp);
  try {
    return await db.$transaction(async (tx) => {
    const duplicate = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (duplicate) {
      if (!entryPayloadMatches(duplicate, { type: "ISSUE", jobId: duplicate.jobId, grossMg, purityBp: Number(purityBp), netMg: null, huid: input.huid })) {
        throw new ApiError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different payload.", 409);
      }
      return { status: 200, entry: serializeEntry(duplicate) };
    }
    const karigar = await tx.karigar.findUnique({ where: { id: input.karigarId } });
    const category = await tx.itemCategory.findUnique({ where: { id: input.categoryId } });
    if (!karigar || !category) throw new ApiError("NOT_FOUND", "Karigar or category not found.", 404);
    let jobNo = input.jobNo;
    if (!jobNo) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74839201)`;
      const existingJobs = await tx.job.findMany({ select: { jobNo: true } });
      const highestNumber = existingJobs.reduce((highest, job) => {
        const match = /^J-(\d+)$/.exec(job.jobNo);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);
      jobNo = `J-${highestNumber + 1}`;
    }
    const job = await tx.job.create({ data: { jobNo, karigarId: input.karigarId, categoryId: input.categoryId } });
    const entry = await tx.ledgerEntry.create({
      data: {
        type: "ISSUE", jobId: job.id, karigarId: input.karigarId, grossMg, purityBp: Number(purityBp),
        fineMg: fine, netMg: null, huid: input.huid ?? null, idempotencyKey: input.idempotencyKey, createdById: actor.id,
      },
    });
    await audit(tx, actor.id, "CREATE", "LEDGER_ENTRY", entry.id, "Created issue ledger entry.");
    return { status: 201, entry: serializeEntry(entry) };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return recoverIdempotentEntry(db, input.idempotencyKey, {
        type: "ISSUE",
        jobId: (await db.ledgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } }))?.jobId ?? "",
        grossMg,
        purityBp: Number(purityBp),
        netMg: null,
        huid: input.huid,
      });
    }
    throw error;
  }
}

export async function createReceipt(db: Db, actor: Actor, input: {
  jobId: string; type: "RECEIPT_PIECE" | "RECEIPT_SCRAP" | "RECEIPT_FILINGS"; grossWeight: string; purity: string; netWeight?: string; huid?: string; idempotencyKey: string;
}) {
  const grossMg = parseWeightToMg(input.grossWeight);
  const purityBp = parsePurityToBp(input.purity);
  const fine = fineMg(grossMg, purityBp);
  const netMg = input.netWeight ? parseWeightToMg(input.netWeight) : null;
  try {
    return await db.$transaction(async (tx) => {
    const duplicate = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (duplicate) {
      if (!entryPayloadMatches(duplicate, { type: input.type, jobId: input.jobId, grossMg, purityBp: Number(purityBp), netMg, huid: input.huid })) {
        throw new ApiError("IDEMPOTENCY_CONFLICT", "The idempotency key was already used for a different payload.", 409);
      }
      return { status: 200, entry: serializeEntry(duplicate) };
    }
    const job = await tx.job.findUnique({ where: { id: input.jobId }, include: { ledgerEntries: true } });
    if (!job) throw new ApiError("NOT_FOUND", "Job not found.", 404);
    if (job.status === "CLOSED") throw new ApiError("JOB_CLOSED", "Closed jobs accept no more entries.", 409);
    const balance = entryBalance(job.ledgerEntries);
    if (balance - fine < 0n) {
      throw new ApiError("NEGATIVE_BALANCE", `Receipt fine ${fine} mg would make outstanding balance ${balance - fine} mg.`, 409);
    }
    const entry = await tx.ledgerEntry.create({
      data: {
        type: input.type, jobId: job.id, karigarId: job.karigarId, grossMg, purityBp: Number(purityBp),
        fineMg: fine, netMg, huid: input.huid ?? null, idempotencyKey: input.idempotencyKey, createdById: actor.id,
      },
    });
    await audit(tx, actor.id, "CREATE", "LEDGER_ENTRY", entry.id, "Created receipt ledger entry.");
    return { status: 201, entry: serializeEntry(entry) };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return recoverIdempotentEntry(db, input.idempotencyKey, {
        type: input.type,
        jobId: input.jobId,
        grossMg,
        purityBp: Number(purityBp),
        netMg,
        huid: input.huid,
      });
    }
    throw error;
  }
}

export async function closeJob(db: Db, actor: Actor, jobId: string) {
  return db.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId }, include: { ledgerEntries: true, category: true } });
    if (!job) throw new ApiError("NOT_FOUND", "Job not found.", 404);
    if (job.status === "CLOSED") throw new ApiError("JOB_CLOSED", "Job is already closed.", 409);
    const issuedFine = job.ledgerEntries.filter((entry) => entry.type === "ISSUE").reduce((sum, entry) => sum + entry.fineMg, 0n);
    const receivedFine = job.ledgerEntries.filter((entry) => entry.type !== "ISSUE").reduce((sum, entry) => sum + entry.fineMg, 0n);
    const rate = await tx.karigarCategoryRate.findUnique({ where: { karigarId_categoryId: { karigarId: job.karigarId, categoryId: job.categoryId } } });
    const wastageBp = rate?.wastageBp ?? job.category.wastageBp;
    const allowed = allowedWastageMg(issuedFine, BigInt(wastageBp));
    const actualLoss = issuedFine - receivedFine;
    const result = {
      issuedFine: serializeWeight(issuedFine),
      receivedFine: serializeWeight(receivedFine),
      allowedWastage: serializeWeight(allowed),
      actualLoss: serializeWeight(actualLoss),
      lossBeyondAllowance: serializeWeight(lossBeyondAllowanceMg(actualLoss, allowed)),
    };
    await tx.job.update({ where: { id: jobId }, data: { status: "CLOSED" } });
    await audit(tx, actor.id, "CLOSE", "JOB", jobId, "Closed job and calculated wastage.");
    return result;
  });
}

export async function getKarigarBalance(db: Db, id: string) {
  const karigar = await db.karigar.findUnique({
    where: { id },
    include: {
      categoryRates: true,
      jobs: { include: { category: true, ledgerEntries: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!karigar) throw new ApiError("NOT_FOUND", "Karigar not found.", 404);
  const openJobs = karigar.jobs.filter((job) => job.status === "OPEN").map((job) => {
    const issued = job.ledgerEntries.filter((entry) => entry.type === "ISSUE").reduce((sum, entry) => sum + entry.fineMg, 0n);
    const received = job.ledgerEntries.filter((entry) => entry.type !== "ISSUE").reduce((sum, entry) => sum + entry.fineMg, 0n);
    const agreedRate = karigar.categoryRates.find((rate) => rate.categoryId === job.categoryId)?.wastageBp
      ?? job.category.wastageBp;
    return {
      jobId: job.id,
      jobNo: job.jobNo,
      balance: serializeWeight(issued - received),
      allowedWastage: serializeWeight(allowedWastageMg(issued, BigInt(agreedRate))),
      actualLoss: serializeWeight(issued - received),
    };
  });
  const entries = karigar.jobs.flatMap((job) => job.ledgerEntries);
  return { karigar: { id: karigar.id, name: karigar.name, code: karigar.code }, balance: serializeWeight(entryBalance(entries)), openJobs };
}

export async function getKarigarLedger(db: Db, id: string, page: number, pageSize: number) {
  const karigar = await db.karigar.findUnique({ where: { id } });
  if (!karigar) throw new ApiError("NOT_FOUND", "Karigar not found.", 404);
  const [entries, total] = await Promise.all([
    db.ledgerEntry.findMany({ where: { karigarId: id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.ledgerEntry.count({ where: { karigarId: id } }),
  ]);
  return { entries: entries.map(serializeEntry), page, pageSize, total };
}

export async function getBalances(db: Db) {
  const karigars = await db.karigar.findMany({ orderBy: { name: "asc" }, include: { ledgerEntries: true } });
  return karigars.map((karigar) => ({ id: karigar.id, name: karigar.name, code: karigar.code, balance: serializeWeight(entryBalance(karigar.ledgerEntries)) }));
}
