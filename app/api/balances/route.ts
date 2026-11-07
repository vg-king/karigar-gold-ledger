import { requireRole } from "../../../lib/require-role";
import { errorResponse, serializeBigInts } from "../../../lib/api";
import { getBalances } from "../../../lib/ledger-service";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const access = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const started = performance.now();
    const result = Response.json(serializeBigInts(await getBalances(prisma)));
    if (process.env.NODE_ENV === "development") console.info(`[timing] GET /api/balances ${(performance.now() - started).toFixed(0)}ms`);
    return result;
  } catch (error) {
    return errorResponse(error);
  }
}
