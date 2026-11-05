import { describe, expect, it } from "vitest";
import { buildStockCsv } from "./stock-service";
import { calculateStockStatement } from "./stock";
import { calculateKarigarBalanceMg } from "./ledger-service";

const date = new Date("2026-11-05T00:00:00.000Z");
function entry(type: "ISSUE" | "RECEIPT_PIECE", fineMg: bigint, jobId: string, createdAt = date) {
  return { type, fineMg, jobId, karigarId: "k1", createdAt };
}
function job(id: string, closedAt: Date | null, entries: ReturnType<typeof entry>[], createdAt = new Date("2026-11-01T00:00:00.000Z")) {
  return { id, jobNo: id, karigarId: "k1", karigarName: "Lakshmi", createdAt, closedAt, status: closedAt ? "CLOSED" : "OPEN", ledgerEntries: entries };
}

describe("daily stock statement", () => {
  it("reconciles seed-like data and groups open karigar stock", () => {
    const jobs = [
      job("j1", null, [entry("ISSUE", 100000n, "j1"), entry("RECEIPT_PIECE", 90000n, "j1")]),
      job("j2", date, [entry("ISSUE", 50000n, "j2"), entry("RECEIPT_PIECE", 45000n, "j2")]),
    ];
    const statement = calculateStockStatement(
      [{ type: "OPENING", movementDate: new Date("2026-10-01"), fineMg: 1000000n, note: "opening" }],
      [
        entry("ISSUE", 100000n, "j1"), entry("RECEIPT_PIECE", 90000n, "j1"),
        entry("ISSUE", 50000n, "j2"), entry("RECEIPT_PIECE", 45000n, "j2"),
      ],
      jobs,
      date,
    );
    expect(statement.reconciled).toBe(true);
    expect(statement.vaultMg).toBe(985000n);
    expect(statement.withKarigarsMg).toBe(10000n);
    expect(calculateKarigarBalanceMg(jobs)).toBe(statement.withKarigarsMg);
    expect(calculateKarigarBalanceMg(jobs) + statement.writtenOffMg).toBe(15000n);
  });

  it("keeps a job open before its later close timestamp", () => {
    const statement = calculateStockStatement(
      [{ type: "OPENING", movementDate: new Date("2026-10-01"), fineMg: 100000n, note: "opening" }],
      [],
      [job("j1", new Date("2026-11-06"), [entry("ISSUE", 10000n, "j1")])],
      date,
    );
    expect(statement.withKarigarsMg).toBe(10000n);
    expect(statement.writtenOffMg).toBe(0n);
  });

  it("accounts for refiner sends and returns", () => {
    const statement = calculateStockStatement(
      [
        { type: "OPENING", movementDate: new Date("2026-10-01"), fineMg: 100000n, note: "opening" },
        { type: "REFINER_SEND", movementDate: new Date("2026-11-01"), fineMg: 20000n, note: "send" },
        { type: "REFINER_RETURN", movementDate: new Date("2026-11-02"), fineMg: 5000n, note: "return" },
      ],
      [],
      [],
      date,
    );
    expect(statement.atRefinerMg).toBe(15000n);
    expect(statement.reconciled).toBe(true);
  });

  it("handles empty data and flags negative vault without throwing", () => {
    const empty = calculateStockStatement([], [], [], date);
    expect(empty.reconciled).toBe(true);
    const negative = calculateStockStatement(
      [{ type: "OPENING", movementDate: new Date("2026-10-01"), fineMg: 1n, note: "opening" }],
      [entry("ISSUE", 2n, "j1")],
      [],
      date,
    );
    expect(negative.warning).toContain("negative");
  });

  it("builds a BOM CSV with fixed decimals and injection protection", () => {
    const csv = buildStockCsv({
      date: "2026-11-05", openingMg: 1000n, vaultMg: 1000n, withKarigarsMg: 0n, atRefinerMg: 0n,
      writtenOffMg: 0n, reconciliationDifferenceMg: 0n, reconciled: true, warning: null,
      karigars: [{ karigarId: "1", karigarName: "=Injected", fineMg: 1n }],
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("05-11-2026");
    expect(csv).toContain(",1.000,");
    expect(csv).toContain(",'=Injected,");
  });

  it("keeps trailing zeroes in every CSV weight", () => {
    const csv = buildStockCsv({
      date: "2026-11-05", openingMg: 596940n, vaultMg: 590940n, withKarigarsMg: 240679n, atRefinerMg: 126000n,
      writtenOffMg: 50380n, reconciliationDifferenceMg: 0n, reconciled: true, warning: null,
      karigars: [{ karigarId: "1", karigarName: "Lakshmi", fineMg: 50380n }],
    });
    expect(csv).toContain(",590.940,");
    expect(csv).toContain(",126.000,");
    expect(csv).toContain(",240.679,");
    expect(csv).toContain(",50.380,");
  });
});
