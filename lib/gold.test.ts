import { describe, expect, it } from "vitest";
import {
  allowedWastageMg,
  fineMg,
  formatMg,
  formatSignedMg,
  lossBeyondAllowanceMg,
  lossBp,
  parsePurityToBp,
  parseWeightToMg,
  runningBalanceMg,
} from "./gold";

describe("gold maths", () => {
  it("parses and formats milligram weights", () => {
    expect(parseWeightToMg("112.450")).toBe(112450n);
    expect(parseWeightToMg("1.5")).toBe(1500n);
    expect(parseWeightToMg("0.001")).toBe(1n);
    expect(parseWeightToMg("007.5")).toBe(7500n);
    expect(formatMg(112450n)).toBe("112.450");
    expect(formatMg(0n)).toBe("0.000");
    expect(formatMg(123456789012345678901234567890n)).toBe("123456789012345678901234567.890");
  });

  it("parses purity basis points", () => {
    expect(parsePurityToBp("91.60")).toBe(9160n);
    expect(parsePurityToBp("0")).toBe(0n);
    expect(parsePurityToBp("100")).toBe(10000n);
  });

  it("calculates fine gold with half-up rounding", () => {
    expect(fineMg(parseWeightToMg("120.000"), 9160n)).toBe(109920n);
    expect(fineMg(parseWeightToMg("112.450"), 9160n)).toBe(103004n);
    expect(fineMg(parseWeightToMg("3.300"), 9160n)).toBe(3023n);
    expect(fineMg(0n, 9160n)).toBe(0n);
    expect(fineMg(123456789012345678901234567890n, 10000n)).toBe(123456789012345678901234567890n);
  });

  it("rounds exact half-milligram values up", () => {
    expect(fineMg(1n, 5000n)).toBe(1n);
    expect(fineMg(3n, 5000n)).toBe(2n);
    expect(allowedWastageMg(1n, 5000n)).toBe(1n);
  });

  it("calculates running balance across issue and receipt types", () => {
    expect(runningBalanceMg([
      { type: "ISSUE", fineMg: fineMg(120000n, 9160n) },
      { type: "RECEIPT_PIECE", fineMg: fineMg(112450n, 9160n) },
      { type: "RECEIPT_SCRAP", fineMg: fineMg(3300n, 9160n) },
      { type: "RECEIPT_FILINGS", fineMg: 0n },
    ])).toBe(3893n);
  });

  it("calculates allowance and loss beyond it", () => {
    expect(allowedWastageMg(109920n, 300n)).toBe(3298n);
    expect(lossBeyondAllowanceMg(3893n, 3298n)).toBe(595n);
    expect(lossBeyondAllowanceMg(3298n, 3893n)).toBe(0n);
    expect(lossBeyondAllowanceMg(-1n, 0n)).toBe(0n);
  });

  it("rounds loss basis points half-up with bigint maths", () => {
    expect(lossBp(1000n, 995n)).toBe(50n);
    expect(lossBp(3n, 2n)).toBe(3333n);
  });

  it("rejects invalid values", () => {
    for (const value of ["", " ", "-1.000", "1.0000", "NaN", "1e2", ".500"]) {
      expect(() => parseWeightToMg(value)).toThrow();
    }
    for (const value of ["101", "100.01", "-1", "91.600", "NaN"]) {
      expect(() => parsePurityToBp(value)).toThrow();
    }
    expect(() => formatMg(-1n)).toThrow();
    expect(formatSignedMg(-12500n)).toBe("-12.500");
    expect(formatSignedMg(0n)).toBe("0.000");
    expect(() => fineMg(-1n, 9160n)).toThrow();
    expect(() => fineMg(1n, 10001n)).toThrow();
    expect(() => allowedWastageMg(1n, 10001n)).toThrow();
    expect(() => runningBalanceMg([{ type: "ISSUE", fineMg: -1n }])).toThrow();
  });
});
