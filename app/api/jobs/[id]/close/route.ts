import { requireRole } from "../../../../../lib/require-role";
import { errorResponse, serializeBigInts } from "../../../../../lib/api";
import { closeJob } from "../../../../../lib/ledger-service";
import { prisma } from "../../../../../lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireRole(["ISSUE_CLERK"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const { id } = await context.params;
    return Response.json(serializeBigInts(await closeJob(prisma, access.user, id)));
  } catch (error) {
    return errorResponse(error);
  }
}
