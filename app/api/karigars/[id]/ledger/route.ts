import { requireRole } from "../../../../../lib/require-role";
import { errorResponse, serializeBigInts } from "../../../../../lib/api";
import { pageSchema } from "../../../../../lib/ledger-validation";
import { getKarigarLedger } from "../../../../../lib/ledger-service";
import { prisma } from "../../../../../lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const { id } = await context.params;
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const { page, pageSize } = pageSchema.parse(query);
    return Response.json(serializeBigInts(await getKarigarLedger(prisma, id, page, pageSize)));
  } catch (error) {
    return errorResponse(error);
  }
}
