import { z } from "zod";
import { parsePurityToBp, parseWeightToMg } from "./gold";

const id = z.string().min(1, "Please select a record.").uuid("Please select a valid record.");
const weight = z.string().min(1, "Weight is required.").max(40, "Weight is too long.").refine((value) => {
  try { parseWeightToMg(value); return true; } catch { return false; }
}, "Weight must be a non-negative decimal with at most 3 decimals.");
const purity = z.string().min(1, "Purity is required.").max(10, "Purity is too long.").refine((value) => {
  try { parsePurityToBp(value); return true; } catch { return false; }
}, "Purity must be between 0 and 100 with at most 2 decimals.");
const key = z.string().min(8, "Please try submitting again.").max(128, "Submission key is too long.");
const optionalText = (max: number) => z.string().trim().min(1, "This field is required.").max(max, "This field is too long.").optional();

export const karigarCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  nameTa: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().min(3, "Phone number is required.").max(30),
  active: z.boolean().optional(),
  categoryRates: z.record(id, z.number().int().min(0).max(1000)).optional(),
});

export const karigarUpdateSchema = karigarCreateSchema.partial();

export const issueSchema = z.object({
  karigarId: z.string().min(1, "Please select a karigar.").uuid("Please select a valid karigar."),
  categoryId: z.string().min(1, "Choose an item category.").uuid("Please select a valid category."),
  grossWeight: weight,
  purity,
  huid: optionalText(80),
  idempotencyKey: key,
  jobNo: z.string().trim().min(1).max(40).optional(),
  aiReadingMg: z.string().regex(/^\d+$/).optional(),
  aiReadingPurityBp: z.number().int().min(0).max(10000).optional(),
  aiResolution: z.enum(["NONE", "USED_AI", "KEPT_TYPED"]).default("NONE"),
});

export const receiptSchema = z.object({
  jobId: z.string().min(1, "Please select an open job.").uuid("Please select a valid open job."),
  type: z.enum(["RECEIPT_PIECE", "RECEIPT_SCRAP", "RECEIPT_FILINGS"], { error: "Choose a receipt type." }),
  grossWeight: weight,
  purity,
  netWeight: weight.optional(),
  huid: optionalText(80),
  idempotencyKey: key,
  aiReadingMg: z.string().regex(/^\d+$/).optional(),
  aiReadingPurityBp: z.number().int().min(0).max(10000).optional(),
  aiResolution: z.enum(["NONE", "USED_AI", "KEPT_TYPED"]).default("NONE"),
}).superRefine((value, context) => {
  if (value.type === "RECEIPT_PIECE" && !value.huid) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["huid"], message: "HUID is required for piece receipts." });
  }
  if (value.netWeight) {
    try {
      if (parseWeightToMg(value.netWeight) > parseWeightToMg(value.grossWeight)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["netWeight"], message: "Net weight cannot exceed gross weight." });
      }
    } catch {
      // The field-level weight validator reports malformed values.
    }
  }
  if (value.aiResolution !== "NONE" && !value.aiReadingMg && value.aiReadingPurityBp === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["aiResolution"], message: "AI resolution requires an AI reading." });
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
