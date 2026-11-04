import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import { requireRole } from "./require-role";

const clerkSession = {
  user: { id: "clerk", name: "Clerk", email: "clerk@example.com", role: "ISSUE_CLERK" },
  expires: "2099-01-01",
} as Session;

const financeSession = {
  user: { id: "finance", name: "Finance", email: "finance@example.com", role: "FINANCE_HEAD" },
  expires: "2099-01-01",
} as Session;

describe("requireRole", () => {
  it("returns 401 for no session in an API request", async () => {
    const result = await requireRole(["ISSUE_CLERK"], { mode: "api", session: null });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns 403 for a wrong role", async () => {
    const result = await requireRole(["FINANCE_HEAD"], { mode: "api", session: clerkSession });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });

  it("allows the required role", async () => {
    const result = await requireRole(["FINANCE_HEAD"], { mode: "api", session: financeSession });
    expect(result).toBe(financeSession);
  });

  it("returns 403 for a clerk on the finance route", async () => {
    const result = await requireRole(["FINANCE_HEAD"], { mode: "api", session: clerkSession });
    expect((result as Response).status).toBe(403);
  });
});

