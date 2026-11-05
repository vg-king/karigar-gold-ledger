import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client";
import { serializeWeight } from "./api";
import { createReceipt, closeJob } from "./ledger-service";
import { receiptSchema } from "./ledger-validation";

const actor = { id: "user-1" };
const jobId = "job-1";
const karigarId = "karigar-1";
const categoryId = "category-1";

function entry(type: "ISSUE" | "RECEIPT_PIECE" | "RECEIPT_SCRAP", fineMg: bigint, grossMg = fineMg) {
  return {
    id: `${type}-${fineMg}`,
    type,
    jobId,
    karigarId,
    grossMg,
    purityBp: 9160,
    fineMg,
    netMg: null,
    huid: null,
    idempotencyKey: `${type}-${fineMg}`,
    createdById: actor.id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function database(overrides: Record<string, unknown> = {}) {
  const tx = {
    ledgerEntry: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
        ...entry(data.type, data.fineMg, data.grossMg),
        ...data,
        id: "created-entry",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      })),
    },
    job: {
      findUnique: vi.fn().mockResolvedValue({
        id: jobId,
        karigarId,
        categoryId,
        status: "OPEN",
        category: { wastageBp: 300 },
        ledgerEntries: [entry("ISSUE", 109920n, 120000n), entry("RECEIPT_PIECE", 103004n, 112450n), entry("RECEIPT_SCRAP", 3023n, 3300n)],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    karigarCategoryRate: {
      findUnique: vi.fn().mockResolvedValue({ wastageBp: 300 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
  return {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    ...tx,
  } as unknown as PrismaClient;
}

describe("ledger service", () => {
  it("serializes bigint weights as milligrams and formatted grams", () => {
    expect(serializeWeight(112450n)).toEqual({ mg: "112450", grams: "112.450" });
  });

  it("returns the original receipt for a duplicate idempotency key", async () => {
    const original = entry("RECEIPT_SCRAP", 3023n, 3300n);
    const db = database();
    const transaction = db as unknown as { ledgerEntry: { findUnique: ReturnType<typeof vi.fn> } };
    transaction.ledgerEntry.findUnique.mockResolvedValue(original);
    const result = await createReceipt(db, actor, {
      jobId, type: "RECEIPT_SCRAP", grossWeight: "3.300", purity: "91.60", idempotencyKey: original.idempotencyKey,
    });
    expect(result.status).toBe(200);
    expect(result.entry.id).toBe(original.id);
  });

  it("rejects a reused idempotency key with a different payload", async () => {
    const db = database();
    const transaction = db as unknown as { ledgerEntry: { findUnique: ReturnType<typeof vi.fn> } };
    transaction.ledgerEntry.findUnique.mockResolvedValue(entry("RECEIPT_SCRAP", 3023n, 3300n));
    await expect(createReceipt(db, actor, {
      jobId, type: "RECEIPT_SCRAP", grossWeight: "4.300", purity: "91.60", idempotencyKey: "RECEIPT-SCRAP-3023",
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
  });

  it("returns the original entry when a concurrent create loses the unique-key race", async () => {
    const original = entry("RECEIPT_SCRAP", 3023n, 3300n);
    const db = database();
    const transaction = db as unknown as {
      ledgerEntry: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
      $transaction: ReturnType<typeof vi.fn>;
    };
    transaction.ledgerEntry.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(original);
    transaction.ledgerEntry.create.mockRejectedValueOnce({ code: "P2002" });
    const result = await createReceipt(db, actor, {
      jobId, type: "RECEIPT_SCRAP", grossWeight: "3.300", purity: "91.60", idempotencyKey: original.idempotencyKey,
    });
    expect(result.status).toBe(200);
    expect(result.entry.id).toBe(original.id);
    expect(transaction.ledgerEntry.create).toHaveBeenCalledTimes(1);
  });

  it("rejects receipts that make the outstanding balance negative", async () => {
    const db = database({
      job: {
        findUnique: vi.fn().mockResolvedValue({
          id: jobId, karigarId, categoryId, status: "OPEN", category: { wastageBp: 300 },
          ledgerEntries: [entry("ISSUE", 100n)],
        }),
      },
    });
    await expect(createReceipt(db, actor, {
      jobId, type: "RECEIPT_SCRAP", grossWeight: "0.200", purity: "100", idempotencyKey: "negative-balance",
    })).rejects.toMatchObject({ code: "NEGATIVE_BALANCE", status: 409 });
  });

  it("rejects entries for closed jobs", async () => {
    const db = database({
      job: {
        findUnique: vi.fn().mockResolvedValue({
          id: jobId, karigarId, categoryId, status: "CLOSED", category: { wastageBp: 300 }, ledgerEntries: [],
        }),
      },
    });
    await expect(createReceipt(db, actor, {
      jobId, type: "RECEIPT_SCRAP", grossWeight: "0.100", purity: "91.60", idempotencyKey: "closed-job",
    })).rejects.toMatchObject({ code: "JOB_CLOSED", status: 409 });
  });

  it("calculates Murugesan sample close maths", async () => {
    const result = await closeJob(database(), actor, jobId);
    expect(result.issuedFine.mg).toBe("109920");
    expect(result.receivedFine.mg).toBe("106027");
    expect(result.allowedWastage.mg).toBe("3298");
    expect(result.actualLoss.mg).toBe("3893");
    expect(result.lossBeyondAllowance.mg).toBe("595");
  });
});

describe("receipt validation", () => {
  it("requires HUID for piece receipts", () => {
    const result = receiptSchema.safeParse({
      jobId, type: "RECEIPT_PIECE", grossWeight: "1.000", purity: "91.60", idempotencyKey: "piece-without-huid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects net weight greater than gross weight", () => {
    const result = receiptSchema.safeParse({
      jobId: "123e4567-e89b-12d3-a456-426614174000", type: "RECEIPT_PIECE", grossWeight: "1.000", netWeight: "1.001",
      purity: "91.60", huid: "HUID123", idempotencyKey: "net-over-gross",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["netWeight"]);
  });
});
