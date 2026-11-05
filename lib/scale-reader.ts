export type ScaleReading = { weight: string; purity: string; confidence: "high" | "low" };

export function readScalePhoto(file: File): Promise<ScaleReading | null> {
  void file;
  return Promise.resolve(null);
}
