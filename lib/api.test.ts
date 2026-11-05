import { describe, expect, it } from "vitest";
import { serializeBigInts } from "./api";

describe("API BigInt serialization", () => {
  it("recursively converts every raw BigInt to shared weight objects", () => {
    const result = serializeBigInts({ fineMg: 596940n, nested: [{ loss: 47357n }] });
    expect(result).toEqual({
      fineMg: { mg: "596940", grams: "596.940" },
      nested: [{ loss: { mg: "47357", grams: "47.357" } }],
    });
    expect(JSON.stringify(result)).not.toContain("BigInt");
  });
});
