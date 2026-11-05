import { describe, expect, it, vi } from "vitest";

const { auth, getLossAlerts, prisma } = vi.hoisted(() => ({
  auth: vi.fn(),
  getLossAlerts: vi.fn().mockResolvedValue([]),
  prisma: {},
}));

vi.mock("../../../auth", () => ({ auth }));
vi.mock("../../../lib/alerts", () => ({ getLossAlerts }));
vi.mock("../../../lib/prisma", () => ({ prisma }));

import { GET } from "./route";

function session(role: "ISSUE_CLERK" | "FINANCE_HEAD") {
  return { user: { id: "user-1", name: "Test", email: "test@example.com", role }, expires: "2099-01-01" };
}

describe("loss alert role guard", () => {
  it("returns 403 to a clerk", async () => {
    auth.mockResolvedValueOnce(session("ISSUE_CLERK"));
    expect((await GET()).status).toBe(403);
    expect(getLossAlerts).not.toHaveBeenCalled();
  });

  it("serializes BigInt weights in alert responses", async () => {
    auth.mockResolvedValueOnce(session("FINANCE_HEAD"));
    getLossAlerts.mockResolvedValueOnce([{ id: "a1", actualLoss: 47357n }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ alerts: [{ id: "a1", actualLoss: { mg: "47357", grams: "47.357" } }] });
  });
});
