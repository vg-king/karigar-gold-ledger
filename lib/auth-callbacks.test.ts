import { describe, expect, it } from "vitest";
import { authCallbacks } from "./auth-callbacks";

describe("Auth.js identity callbacks", () => {
  it("copies the authenticated user id into the JWT and session", () => {
    const token = authCallbacks.jwt({
      token: { role: "ISSUE_CLERK" },
      user: { id: "user-123", role: "ISSUE_CLERK", name: null, email: null },
    });
    const session = authCallbacks.session({
      session: { user: { role: "ISSUE_CLERK" } } as Parameters<typeof authCallbacks.session>[0]["session"],
      user: { id: "user-123", role: "ISSUE_CLERK", name: "User", email: "user@example.com", emailVerified: null },
      token,
      newSession: false,
    });
    expect(token.id).toBe("user-123");
    expect(session.user?.id).toBe("user-123");
  });
});
