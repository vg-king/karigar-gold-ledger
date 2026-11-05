import { describe, expect, it, vi } from "vitest";
import { calculateFineWeight, getSubmissionKey } from "./entry-form";

describe("entry form helpers", () => {
  it("calculates fine weight with the shared integer gold maths", () => {
    expect(calculateFineWeight("120.000", "91.60")).toBe("109920");
    expect(calculateFineWeight("invalid", "91.60")).toBe("");
  });

  it("reuses a submission key after a retry", () => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "generated-key") });
    const first = getSubmissionKey(null);
    expect(getSubmissionKey(first)).toBe(first);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
