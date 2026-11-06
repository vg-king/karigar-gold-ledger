import { z } from "zod";
import { parsePurityToBp, parseWeightToMg } from "./gold";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Official model docs list Gemini 3.5 Flash-Lite as the current budget multimodal default.
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

const modelOutputSchema = z.object({
  weightGrams: z.string().nullable(),
  purityPercent: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  readableText: z.string(),
});

export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type ScaleResponse = {
  status: "ok" | "low_confidence" | "unreadable" | "unavailable";
  weight: { mg: string; grams: string } | null;
  purity: { bp: number; percent: string } | null;
  confidence: ModelOutput["confidence"] | null;
  message: string;
  mock?: boolean;
  readableText?: string;
};

export const UNREADABLE_MESSAGE = "Could not read this photo clearly. Please enter the weight by hand or retake the photo";

function jsonFromModelText(text: string): unknown {
  const withoutFence = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON.");
  return JSON.parse(withoutFence.slice(start, end + 1));
}

export function parseModelOutput(text: string): ModelOutput {
  return modelOutputSchema.parse(jsonFromModelText(text));
}

export function validateModelReading(output: ModelOutput) {
  const weightMg = output.weightGrams === null ? null : parseWeightToMg(output.weightGrams);
  const purityBp = output.purityPercent === null ? null : parsePurityToBp(output.purityPercent);
  if (weightMg !== null && (weightMg <= 0n || weightMg > 5_000_000n)) throw new Error("Weight is outside the supported range.");
  if (purityBp !== null && (purityBp < 0n || purityBp > 10_000n)) throw new Error("Purity is outside the supported range.");
  return { weightMg, purityBp };
}

export function validateImage(file: Pick<File, "type" | "size">): "image/jpeg" | "image/png" | "image/webp" {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Photo must be 4 MB or smaller.");
  if (file.type !== "image/jpeg" && file.type !== "image/png" && file.type !== "image/webp") throw new Error("Photo must be JPEG, PNG, or WebP.");
  return file.type;
}

export function imageMimeFromBytes(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function validateImageBytes(file: Pick<File, "type" | "size">, bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" {
  const declared = validateImage(file);
  const actual = imageMimeFromBytes(bytes);
  if (!actual || actual !== declared) throw new Error("The image bytes do not match a supported JPEG, PNG, or WebP file.");
  return actual;
}

export function mockScaleReading(file: Pick<File, "name" | "size">): ScaleResponse {
  const seed = [...file.name].reduce((sum, character) => sum + character.charCodeAt(0), file.size);
  const weightMg = BigInt(1000 + (seed % 9000));
  return {
    status: "ok",
    weight: { mg: weightMg.toString(), grams: `${weightMg / 1000n}.${(weightMg % 1000n).toString().padStart(3, "0")}` },
    purity: { bp: 9160, percent: "91.60" },
    confidence: "medium",
    message: "Demo reading (no AI key configured).",
    mock: true,
    readableText: "Deterministic demo reading.",
  };
}

export async function readScalePhoto(file: File): Promise<ScaleResponse> {
  const body = new FormData();
  body.append("image", file);
  const response = await fetch("/api/ai/read-scale", { method: "POST", body });
  const result = await response.json() as ScaleResponse;
  if (!response.ok) {
    const errorResult = result as unknown as { error?: { code?: string; message?: string } };
    if (response.status === 429 || errorResult.error?.code === "RATE_LIMITED") {
      throw new Error("Too many photo reads. Wait a minute or enter the weight by hand.");
    }
    throw new Error(result.message || errorResult.error?.message || "Could not read the photo.");
  }
  return result;
}

export function toScaleResponse(output: ModelOutput, mock = false): ScaleResponse {
  const { weightMg, purityBp } = validateModelReading(output);
  const status = output.confidence === "low" ? "low_confidence" : weightMg === null && purityBp === null ? "unreadable" : "ok";
  return {
    status,
    weight: weightMg === null ? null : { mg: weightMg.toString(), grams: `${weightMg / 1000n}.${(weightMg % 1000n).toString().padStart(3, "0")}` },
    purity: purityBp === null ? null : { bp: Number(purityBp), percent: `${purityBp / 100n}.${(purityBp % 100n).toString().padStart(2, "0")}` },
    confidence: output.confidence,
    message: status === "unreadable" ? "Could not read this photo clearly. Please enter the weight by hand or retake the photo." : status === "low_confidence" ? "The reading is low confidence. Please check the scale before using it." : "Reading complete. Check it against the photo before saving.",
    ...(mock ? { mock: true } : {}),
    readableText: output.readableText,
  };
}

export function scaleValuesDiffer(
  reading: { weight: { mg: string } | null; purity: { bp: number } | null },
  typedWeight: string,
  typedPurity: string,
): boolean {
  try {
    return Boolean(
      reading.weight && parseWeightToMg(typedWeight) !== BigInt(reading.weight.mg)
      || reading.purity && parsePurityToBp(typedPurity) !== BigInt(reading.purity.bp),
    );
  } catch {
    return false;
  }
}

export function aiResolutionEvidence(
  resolution: "USED_AI" | "KEPT_TYPED",
  reading: { weight: { mg: string } | null; purity: { bp: number } | null },
) {
  return {
    aiReadingMg: reading.weight?.mg,
    aiReadingPurityBp: reading.purity?.bp,
    aiResolution: resolution,
  } as const;
}

export function canUseScaleReading(reading: Pick<ScaleResponse, "weight" | "purity">): boolean {
  return reading.weight !== null || reading.purity !== null;
}
