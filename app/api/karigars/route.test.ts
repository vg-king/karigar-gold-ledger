import { describe, expect, it, vi } from "vitest";

const { auth, createKarigar } = vi.hoisted(() => ({
  auth: vi.fn(),
  createKarigar: vi.fn().mockResolvedValue({ id: "created" }),
}));

vi.mock("../../../auth", () => ({ auth }));
vi.mock("../../../lib/ledger-service", () => ({ createKarigar }));
vi.mock("../../../lib/prisma", () => ({ prisma: {} }));

import { POST } from "./route";

const validBody = {
  name: "Test Karigar",
  phone: "9000000010",
};

function session(role: "ISSUE_CLERK" | "FINANCE_HEAD") {
  return {
    user: { id: "user-1", name: "Test User", email: "test@example.com", role },
    expires: "2099-01-01",
  };
}

describe("karigar master role guards", () => {
  it("returns 401 to an unauthenticated create request", async () => {
    auth.mockResolvedValueOnce(null);
    const response = await POST(new Request("http://localhost/api/karigars", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(401);
  });

  it("returns 403 when a clerk tries to create a karigar", async () => {
    auth.mockResolvedValueOnce(session("ISSUE_CLERK"));
    const response = await POST(new Request("http://localhost/api/karigars", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(403);
    expect(createKarigar).not.toHaveBeenCalled();
  });

  it("allows finance heads to create a karigar", async () => {
    auth.mockResolvedValueOnce(session("FINANCE_HEAD"));
    const response = await POST(new Request("http://localhost/api/karigars", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(201);
  });
});
