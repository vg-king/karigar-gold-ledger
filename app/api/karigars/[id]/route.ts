import { requireRole } from "../../../../lib/require-role";
import { errorResponse, readJson, serializeBigInts } from "../../../../lib/api";
import { karigarUpdateSchema } from "../../../../lib/ledger-validation";
import { updateKarigar } from "../../../../lib/ledger-service";
import { prisma } from "../../../../lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const { id } = await context.params;
    const input = await readJson(request, karigarUpdateSchema);
    return Response.json(serializeBigInts(await updateKarigar(prisma, access.user, id, input)));
  } catch (error) {
    return errorResponse(error);
  }
}
