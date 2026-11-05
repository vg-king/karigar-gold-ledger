import { requireRole } from "../../../lib/require-role";
import { errorResponse, readJson, serializeBigInts } from "../../../lib/api";
import { receiptSchema } from "../../../lib/ledger-validation";
import { createReceipt } from "../../../lib/ledger-service";
import { prisma } from "../../../lib/prisma";

export async function POST(request: Request) {
  const access = await requireRole(["ISSUE_CLERK"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const input = await readJson(request, receiptSchema);
    const result = await createReceipt(prisma, access.user, input);
    return Response.json(serializeBigInts(result.entry), { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}
