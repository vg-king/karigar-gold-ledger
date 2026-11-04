import { describe, expect, it } from "vitest";
import { formatGoldForDisplay } from "./format-gold";

describe("formatGoldForDisplay", () => {
  it("uses three decimals and tabular-ready text", () => {
    expect(formatGoldForDisplay("112450")).toBe("112.450");
    expect(formatGoldForDisplay(1n)).toBe("0.001");
  });

  it("never displays a negative gold amount", () => {
    expect(() => formatGoldForDisplay("-1")).toThrow();
  });
});
