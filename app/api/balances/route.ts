import { requireRole } from "../../../lib/require-role";
import { errorResponse } from "../../../lib/api";
import { getBalances } from "../../../lib/ledger-service";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const access = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    return Response.json(await getBalances(prisma));
  } catch (error) {
    return errorResponse(error);
  }
}

