import { z } from "zod";
import { formatMg } from "./gold";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({
      error: { code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) },
    }, { status: error.status });
  }
  console.error("API request failed:", error);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError("VALIDATION_ERROR", issue.message, 422, issue.path.join(".") || undefined);
  }
  return parsed.data;
}

export function serializeWeight(value: bigint) {
  return { mg: value.toString(), grams: formatMg(value) };
}

export function serializeBigInts<T>(value: T): T {
  if (typeof value === "bigint") {
    return serializeWeight(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeBigInts(item)) as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeBigInts(item)])) as T;
  }
  return value;
}

export function serializeEntry(entry: {
  id: string;
  type: string;
  grossMg: bigint;
  purityBp: number;
  fineMg: bigint;
  netMg: bigint | null;
  huid: string | null;
  idempotencyKey: string;
  jobId: string;
  karigarId: string;
  createdById: string;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    type: entry.type,
    gross: serializeWeight(entry.grossMg),
    purityBp: entry.purityBp,
    fine: serializeWeight(entry.fineMg),
    net: entry.netMg === null ? null : serializeWeight(entry.netMg),
    huid: entry.huid,
    idempotencyKey: entry.idempotencyKey,
    jobId: entry.jobId,
    karigarId: entry.karigarId,
    createdById: entry.createdById,
    createdAt: entry.createdAt.toISOString(),
  };
}
