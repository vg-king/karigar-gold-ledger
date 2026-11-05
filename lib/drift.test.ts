import { describe, expect, it } from "vitest";
import { evaluateDrift } from "./drift";

describe("loss drift", () => {
  it("alerts on a rising series", () => {
    expect(evaluateDrift([79, 139, 229], 340).alert).toBe(true);
  });
  it("does not alert on flat or improving series", () => {
    expect(evaluateDrift([100, 100, 100], 100).alert).toBe(false);
    expect(evaluateDrift([300, 250, 200], 100).alert).toBe(false);
  });
  it("requires three prior jobs and floors zero deviation", () => {
    expect(evaluateDrift([100, 110], 300).alert).toBe(false);
    const result = evaluateDrift([100, 100, 100], 200);
    expect(result.standardDeviationBp).toBe(20);
    expect(result.alert).toBe(true);
  });
});
