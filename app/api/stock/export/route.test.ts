import { describe, expect, it, vi } from "vitest";

const { auth, getStockForCsv, prisma } = vi.hoisted(() => ({
  auth: vi.fn(),
  getStockForCsv: vi.fn(),
  prisma: {},
}));

vi.mock("../../../../auth", () => ({ auth }));
vi.mock("../../../../lib/stock-service", async () => ({
  ...(await vi.importActual<typeof import("../../../../lib/stock-service")>("../../../../lib/stock-service")),
  getStockForCsv,
}));
vi.mock("../../../../lib/prisma", () => ({ prisma }));

import { GET } from "./route";
import { ApiError } from "../../../../lib/api";

describe("stock export route", () => {
  it("returns fixed-decimal weights in the raw CSV text", async () => {
    auth.mockResolvedValueOnce({ user: { id: "finance", role: "FINANCE_HEAD" } });
    getStockForCsv.mockResolvedValueOnce({
      date: "2026-11-05",
      vaultMg: 590940n,
      withKarigarsMg: 240679n,
      atRefinerMg: 126000n,
      writtenOffMg: 0n,
      karigars: [{ karigarId: "k1", karigarName: "Lakshmi", fineMg: 50380n }],
    });

    const response = await GET(new Request("http://localhost/api/stock/export?date=2026-11-05"));
    const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(",590.940,");
    expect(csv).toContain(",126.000,");
    expect(csv).toContain(",240.679,");
    expect(csv).toContain(",50.380,");
    expect(response.headers.get("content-disposition")).toContain("stock-statement-2026-11-05.csv");
  });

  it("returns the standard 422 error for a future export date", async () => {
    auth.mockResolvedValueOnce({ user: { id: "finance", role: "FINANCE_HEAD" } });
    getStockForCsv.mockRejectedValueOnce(new ApiError("INVALID_DATE", "Stock statement date cannot be in the future.", 422, "date"));
    const response = await GET(new Request("http://localhost/api/stock/export?date=2999-01-01"));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_DATE", message: "Stock statement date cannot be in the future." } });
  });
});
