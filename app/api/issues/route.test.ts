import { describe, expect, it, vi } from "vitest";

const { auth, createIssue } = vi.hoisted(() => ({
  auth: vi.fn(),
  createIssue: vi.fn(),
}));

vi.mock("../../../auth", () => ({ auth }));
vi.mock("../../../lib/ledger-service", () => ({ createIssue }));
vi.mock("../../../lib/prisma", () => ({ prisma: {} }));

import { POST } from "./route";

describe("issue write identity guard", () => {
  it("returns 401 and never reaches the service without a session user id", async () => {
    auth.mockResolvedValueOnce({
      user: { name: "Clerk", email: "clerk@example.com", role: "ISSUE_CLERK" },
      expires: "2099-01-01",
    });
    const response = await POST(new Request("http://localhost/api/issues", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(401);
    expect(createIssue).not.toHaveBeenCalled();
  });
});
