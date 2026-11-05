import { z } from "zod";
import { requireRole } from "../../../lib/require-role";
import { errorResponse, readJson, serializeBigInts } from "../../../lib/api";
import { getLossAlerts, reviewLossAlert } from "../../../lib/alerts";
import { prisma } from "../../../lib/prisma";

const reviewSchema = z.object({
  alertId: z.string().uuid(),
  reviewNote: z.string().trim().max(1000).optional(),
});

export async function GET() {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    return Response.json(serializeBigInts({ alerts: await getLossAlerts(prisma) }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const input = await readJson(request, reviewSchema);
    await reviewLossAlert(prisma, access.user.id, input.alertId, input.reviewNote);
    return Response.json(serializeBigInts({ alerts: await getLossAlerts(prisma) }));
  } catch (error) {
    return errorResponse(error);
  }
}
