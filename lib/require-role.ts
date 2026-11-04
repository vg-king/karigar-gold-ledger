import { forbidden, redirect } from "next/navigation";
import type { Session } from "next-auth";

export type Role = "ISSUE_CLERK" | "FINANCE_HEAD";
export type RequireRoleOptions = {
  mode?: "page" | "api";
  session?: Session | null;
};

export type ApiAccessError = Response;

export function roleIsAllowed(session: Session | null, roles: readonly Role[]): boolean {
  return Boolean(session?.user?.id && session.user.role && roles.includes(session.user.role));
}

export async function requireRole(
  roles: readonly Role[],
  options: RequireRoleOptions = {},
): Promise<Session | ApiAccessError> {
  const session = "session" in options
    ? options.session ?? null
    : await (await import("../auth")).auth();
  if (!session?.user?.id) {
    if (options.mode === "api") {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401 });
    }
    redirect("/login");
  }

  if (!roleIsAllowed(session, roles)) {
    if (options.mode === "api") {
      return Response.json({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } }, { status: 403 });
    }
    forbidden();
  }

  return session;
}
