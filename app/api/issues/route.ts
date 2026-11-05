import { requireRole } from "../../../lib/require-role";
import { errorResponse, readJson, serializeBigInts } from "../../../lib/api";
import { issueSchema } from "../../../lib/ledger-validation";
import { createIssue } from "../../../lib/ledger-service";
import { prisma } from "../../../lib/prisma";

export async function POST(request: Request) {
  const access = await requireRole(["ISSUE_CLERK"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const input = await readJson(request, issueSchema);
    const result = await createIssue(prisma, access.user, input);
    return Response.json(serializeBigInts(result), { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}
