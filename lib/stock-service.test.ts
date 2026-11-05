import { describe, expect, it, vi } from "vitest";
import { createStockMovement } from "./stock-service";

function db(statement = { vault: { mg: "1000" }, atRefiner: { mg: "0" } }) {
  const movement = { id: "movement-1", type: "REFINER_SEND", movementDate: new Date("2026-11-05"), fineMg: 100n, note: "send", idempotencyKey: "key-1" };
  const tx = {
    stockMovement: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(movement),
    },
    ledgerEntry: { findMany: vi.fn().mockResolvedValue([]) },
    job: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    ...tx,
    statement,
  } as never;
}

describe("stock movement writes", () => {
  it("rejects a refiner send larger than vault stock", async () => {
    await expect(createStockMovement(db({ vault: { mg: "10" }, atRefiner: { mg: "0" }}), "user-1", {
      type: "REFINER_SEND", date: "2026-11-05", weight: "0.011", note: "send", idempotencyKey: "key-1",
    })).rejects.toMatchObject({ code: "INSUFFICIENT_VAULT_STOCK", status: 409 });
  });

  it("returns the original movement for a matching idempotency key", async () => {
    const database = db();
    const existing = { id: "movement-1", type: "REFINER_SEND", movementDate: new Date("2026-11-05T00:00:00.000Z"), fineMg: 100n, note: "send", idempotencyKey: "key-1" };
    const transaction = database as { stockMovement: { findUnique: ReturnType<typeof vi.fn> } };
    transaction.stockMovement.findUnique.mockResolvedValue(existing);
    const result = await createStockMovement(database as never, "user-1", {
      type: "REFINER_SEND", date: "2026-11-05", weight: "0.100", note: "send", idempotencyKey: "key-1",
    });
    expect(result.status).toBe(200);
  });
});
