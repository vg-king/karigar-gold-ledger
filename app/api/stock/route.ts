import { requireRole } from "../../../lib/require-role";
import { errorResponse, readJson, serializeBigInts } from "../../../lib/api";
import { getStockStatement, createStockMovement } from "../../../lib/stock-service";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";

const movementSchema = z.object({
  type: z.enum(["REFINER_SEND", "REFINER_RETURN"], { error: "Choose a movement type." }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD."),
  weight: z.string().regex(/^\d+(?:\.\d{1,3})?$/, "Weight must be a non-negative decimal with up to 3 decimals.").refine((value) => value !== "0" && value !== "0.0" && value !== "0.00" && value !== "0.000", "Weight must be greater than zero."),
  note: z.string().trim().min(1, "Movement note is required.").max(500, "Movement note is too long."),
  idempotencyKey: z.string().trim().min(1, "Please try submitting again.").max(200, "Submission key is too long."),
});

export async function GET(request: Request) {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const started = performance.now();
    const result = Response.json(serializeBigInts(await getStockStatement(prisma, new URL(request.url).searchParams.get("date"))));
    if (process.env.NODE_ENV === "development") console.info(`[timing] GET /api/stock ${(performance.now() - started).toFixed(0)}ms`);
    return result;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const input = await readJson(request, movementSchema);
    const result = await createStockMovement(prisma, access.user.id, input);
    return Response.json(serializeBigInts(result), { status: result.status });
  } catch (error) {
    return errorResponse(error);
  }
}
