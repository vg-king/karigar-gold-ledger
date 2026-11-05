import { fineMg, parsePurityToBp, parseWeightToMg } from "./gold";

export function calculateFineWeight(grossWeight: string, purity: string): string {
  if (!grossWeight || !purity) return "";
  try {
    return fineMg(parseWeightToMg(grossWeight), parsePurityToBp(purity)).toString();
  } catch {
    return "";
  }
}

export function getSubmissionKey(currentKey: string | null): string {
  return currentKey ?? crypto.randomUUID();
}
