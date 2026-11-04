import { requireRole } from "../../../lib/require-role";

export async function GET() {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) {
    return access;
  }
  return Response.json({ message: "Finance area" });
}

