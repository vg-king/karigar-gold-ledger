export function sanitizeDecimalInput(value: string, decimals: number): string {
  const normalized = value.replace(/[^\d.]/g, "");
  const dot = normalized.indexOf(".");
  if (dot < 0) return normalized;
  return `${normalized.slice(0, dot)}.${normalized.slice(dot + 1).replace(/\./g, "").slice(0, decimals)}`;
}
