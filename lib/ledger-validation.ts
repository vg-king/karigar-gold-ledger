import { z } from "zod";
import { parsePurityToBp, parseWeightToMg } from "./gold";

const id = z.string().uuid();
const weight = z.string().min(1).max(40).refine((value) => {
  try { parseWeightToMg(value); return true; } catch { return false; }
}, "Weight must be a non-negative decimal with at most 3 decimals.");
const purity = z.string().min(1).max(10).refine((value) => {
  try { parsePurityToBp(value); return true; } catch { return false; }
}, "Purity must be between 0 and 100 with at most 2 decimals.");
const key = z.string().min(8).max(128);
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const karigarCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameTa: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().min(3).max(30),
  active: z.boolean().optional(),
  categoryRates: z.record(id, z.number().int().min(0).max(1000)).optional(),
});

export const karigarUpdateSchema = karigarCreateSchema.partial();

export const issueSchema = z.object({
  karigarId: id,
  categoryId: id,
  grossWeight: weight,
  purity,
  huid: optionalText(80),
  idempotencyKey: key,
  jobNo: z.string().trim().min(1).max(40).optional(),
});

export const receiptSchema = z.object({
  jobId: id,
  type: z.enum(["RECEIPT_PIECE", "RECEIPT_SCRAP", "RECEIPT_FILINGS"]),
  grossWeight: weight,
  purity,
  netWeight: weight.optional(),
  huid: optionalText(80),
  idempotencyKey: key,
}).superRefine((value, context) => {
  if (value.type === "RECEIPT_PIECE" && !value.huid) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["huid"], message: "HUID is required for piece receipts." });
  }
});

export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function parseWeight(value: string): bigint {
  return parseWeightToMg(value);
}

export function parsePurity(value: string): bigint {
  return parsePurityToBp(value);
}
