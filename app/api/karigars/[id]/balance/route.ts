import { requireRole } from "../../../../../lib/require-role";
import { errorResponse, serializeBigInts } from "../../../../../lib/api";
import { getKarigarBalance } from "../../../../../lib/ledger-service";
import { prisma } from "../../../../../lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const { id } = await context.params;
    return Response.json(serializeBigInts(await getKarigarBalance(prisma, id)));
  } catch (error) {
    return errorResponse(error);
  }
}
