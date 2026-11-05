import { requireRole } from "../../../lib/require-role";
import { serializeBigInts } from "../../../lib/api";

export async function GET() {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) {
    return access;
  }
  return Response.json(serializeBigInts({ message: "Finance area" }));
}
