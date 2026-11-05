import { requireRole } from "../../../lib/require-role";
import { errorResponse, readJson, serializeBigInts } from "../../../lib/api";
import { karigarCreateSchema } from "../../../lib/ledger-validation";
import { createKarigar } from "../../../lib/ledger-service";
import { prisma } from "../../../lib/prisma";

// A3: Finance heads manage karigar master data; clerks may read it.
export async function GET() {
  const access = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const karigars = await prisma.karigar.findMany({ orderBy: { name: "asc" }, include: { categoryRates: true } });
    return Response.json(serializeBigInts(karigars));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const input = await readJson(request, karigarCreateSchema);
    return Response.json(serializeBigInts(await createKarigar(prisma, access.user, input)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
