import { requireRole } from "../../../../lib/require-role";
import { errorResponse } from "../../../../lib/api";
import { buildStockCsv, getStockForCsv } from "../../../../lib/stock-service";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const access = await requireRole(["FINANCE_HEAD"], { mode: "api" });
  if (access instanceof Response) return access;
  try {
    const date = new URL(request.url).searchParams.get("date");
    const csv = buildStockCsv(await getStockForCsv(prisma, date));
    const fileDate = date ?? new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="stock-statement-${fileDate}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
