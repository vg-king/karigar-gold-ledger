import { requireRole } from "../../../lib/require-role";
import { errorResponse, serializeBigInts } from "../../../lib/api";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const access = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const categories = await prisma.itemCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, wastageBp: true } });
    return Response.json(serializeBigInts(categories));
  } catch (error) {
    return errorResponse(error);
  }
}
