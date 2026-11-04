import { describe, expect, it, vi } from "vitest";

const { auth, updateKarigar } = vi.hoisted(() => ({
  auth: vi.fn(),
  updateKarigar: vi.fn(),
}));

vi.mock("../../../../auth", () => ({ auth }));
vi.mock("../../../../lib/ledger-service", () => ({ updateKarigar }));
vi.mock("../../../../lib/prisma", () => ({ prisma: {} }));

import { PATCH } from "./route";

describe("karigar master PATCH role guard", () => {
  it("returns 403 when a clerk tries to update a karigar", async () => {
    auth.mockResolvedValueOnce({
      user: { id: "clerk-1", name: "Clerk", email: "clerk@example.com", role: "ISSUE_CLERK" },
      expires: "2099-01-01",
    });
    const response = await PATCH(
      new Request("http://localhost/api/karigars/00000000-0000-0000-0000-000000000001", {
        method: "PATCH",
        body: JSON.stringify({ name: "Blocked" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" }) },
    );
    expect(response.status).toBe(403);
    expect(updateKarigar).not.toHaveBeenCalled();
  });
});
