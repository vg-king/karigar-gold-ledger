import { describe, expect, it, vi } from "vitest";

const { auth, getStockStatement, createStockMovement, prisma } = vi.hoisted(() => ({ auth: vi.fn(), getStockStatement: vi.fn().mockResolvedValue({ reconciled: true }), createStockMovement: vi.fn(), prisma: {} }));
vi.mock("../../../auth", () => ({ auth }));
vi.mock("../../../lib/stock-service", () => ({ getStockStatement, createStockMovement }));
vi.mock("../../../lib/prisma", () => ({ prisma }));
import { GET, POST } from "./route";

const session = (role: "ISSUE_CLERK" | "FINANCE_HEAD") => ({ user: { id: "u", name: "User", email: "u@example.com", role }, expires: "2099-01-01" });

describe("stock route access", () => {
  it("returns 401 unauthenticated, 403 to clerks, and 200 to finance", async () => {
    auth.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/api/stock"))).status).toBe(401);
    auth.mockResolvedValueOnce(session("ISSUE_CLERK"));
    expect((await GET(new Request("http://localhost/api/stock"))).status).toBe(403);
    auth.mockResolvedValueOnce(session("FINANCE_HEAD"));
    expect((await GET(new Request("http://localhost/api/stock"))).status).toBe(200);
  });

  it("serializes BigInt movement weights from POST responses", async () => {
    auth.mockResolvedValueOnce(session("FINANCE_HEAD"));
    createStockMovement.mockResolvedValueOnce({
      status: 201,
      movement: { id: "m1", fineMg: 596940n, movementDate: new Date("2026-11-05"), type: "REFINER_SEND" },
    });
    const response = await POST(new Request("http://localhost/api/stock", {
      method: "POST",
      body: JSON.stringify({ type: "REFINER_SEND", date: "2026-11-05", weight: "596.940", note: "test", idempotencyKey: "key-1" }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ movement: { fineMg: { mg: "596940", grams: "596.940" } } });
  });
});
