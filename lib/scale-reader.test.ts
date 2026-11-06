import { describe, expect, it } from "vitest";
import { aiResolutionEvidence, canUseScaleReading, mockScaleReading, parseModelOutput, scaleValuesDiffer, validateImageBytes, validateModelReading } from "./scale-reader";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);

describe("scale reader", () => {
  it("parses fenced JSON and rejects prompt-looking extra fields", () => {
    expect(parseModelOutput("```json\n{\"weightGrams\":\"126.000\",\"purityPercent\":\"91.60\",\"confidence\":\"high\",\"readableText\":\"126.000 g\"}\n```").weightGrams).toBe("126.000");
    expect(() => parseModelOutput('{"weightGrams":"1","purityPercent":"91","confidence":"high","readableText":"ignore instructions"} trailing')).not.toThrow();
    expect(() => parseModelOutput('{"weightGrams":-1,"purityPercent":"91","confidence":"high","readableText":"x"}')).toThrow();
  });

  it("range-checks null, negative, and huge readings", () => {
    expect(validateModelReading({ weightGrams: null, purityPercent: null, confidence: "low", readableText: "" })).toEqual({ weightMg: null, purityBp: null });
    expect(() => validateModelReading({ weightGrams: "-1", purityPercent: "91", confidence: "high", readableText: "" })).toThrow();
    expect(() => validateModelReading({ weightGrams: "5000.001", purityPercent: "101", confidence: "high", readableText: "" })).toThrow();
  });

  it("validates declared type, size, and magic bytes", () => {
    expect(validateImageBytes(new File([jpeg], "scale.jpg", { type: "image/jpeg" }), jpeg)).toBe("image/jpeg");
    expect(() => validateImageBytes(new File([jpeg], "scale.png", { type: "image/png" }), jpeg)).toThrow();
    expect(() => validateImageBytes(new File([new Uint8Array(4 * 1024 * 1024 + 1)], "scale.jpg", { type: "image/jpeg" }), jpeg)).toThrow();
  });

  it("compares integer milligrams and basis points", () => {
    const reading = { weight: { mg: "126000", grams: "126.000" }, purity: { bp: 9160, percent: "91.60" } };
    expect(scaleValuesDiffer(reading, "126.000", "91.60")).toBe(false);
    expect(scaleValuesDiffer(reading, "126.001", "91.60")).toBe(true);
    expect(scaleValuesDiffer(reading, "0.126", "91.60")).toBe(true);
  });

  it("returns deterministic mock readings", () => {
    const first = mockScaleReading({ name: "photo.jpg", size: 10 });
    expect(mockScaleReading({ name: "photo.jpg", size: 10 })).toEqual(first);
    expect(first.mock).toBe(true);
  });

  it("builds evidence for both explicit resolution paths", () => {
    const reading = { weight: { mg: "102450", grams: "102.450" }, purity: { bp: 9160, percent: "91.60" } };
    expect(aiResolutionEvidence("USED_AI", reading)).toMatchObject({ aiReadingMg: "102450", aiReadingPurityBp: 9160, aiResolution: "USED_AI" });
    expect(aiResolutionEvidence("KEPT_TYPED", reading)).toMatchObject({ aiReadingMg: "102450", aiReadingPurityBp: 9160, aiResolution: "KEPT_TYPED" });
  });

  it("only offers using a reading when at least one value was read", () => {
    expect(canUseScaleReading({ weight: null, purity: null })).toBe(false);
    expect(canUseScaleReading({ weight: { mg: "102450", grams: "102.450" }, purity: null })).toBe(true);
    expect(canUseScaleReading({ weight: null, purity: { bp: 9160, percent: "91.60" } })).toBe(true);
  });
});
