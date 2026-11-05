import { describe, expect, it, vi } from "vitest";
import { recomputeLossAlerts } from "./alerts";

function job(id: string, createdAt: string, lossBp: bigint) {
  const issued = 100000n;
  return {
    id, jobNo: id, karigarId: "karigar-1", createdAt: new Date(createdAt),
    category: { wastageBp: 300 }, karigar: { id: "karigar-1", name: "Test" },
    ledgerEntries: [
      { type: "ISSUE", fineMg: issued },
      { type: "RECEIPT_PIECE", fineMg: issued - (issued * lossBp) / 10000n },
    ],
  };
}

describe("loss alert recomputation", () => {
  it("does not create duplicate alerts for the same latest job", async () => {
    const jobs = [job("job-1", "2026-01-01", 79n), job("job-2", "2026-01-02", 139n), job("job-3", "2026-01-03", 229n), job("job-4", "2026-01-04", 340n)];
    let existing = false;
    const db = {
      job: { findMany: vi.fn().mockResolvedValue(jobs) },
      alert: {
        findUnique: vi.fn().mockImplementation(async () => existing ? { id: "alert-1" } : null),
        upsert: vi.fn().mockImplementation(async () => { existing = true; return { id: "alert-1" }; }),
      },
    };
    expect((await recomputeLossAlerts(db as never)).created).toBe(1);
    expect((await recomputeLossAlerts(db as never)).created).toBe(0);
    expect(db.alert.upsert).toHaveBeenCalledTimes(2);
  });
});
