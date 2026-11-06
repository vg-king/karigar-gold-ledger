import { afterEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("../../../../auth", () => ({ auth }));

import { POST } from "./route";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const session = (id: string) => ({ user: { id, role: "ISSUE_CLERK" }, expires: "2099-01-01" });

function request(name = "scale.jpg") {
  const form = new FormData();
  form.append("image", new File([jpeg], name, { type: "image/jpeg" }));
  return new Request("http://localhost/api/ai/read-scale", { method: "POST", body: form });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
  delete process.env.AI_MOCK;
});

describe("read scale route", () => {
  it("requires authentication and supports deterministic mock mode", async () => {
    auth.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    auth.mockResolvedValueOnce(session("mock-user"));
    process.env.AI_MOCK = "1";
    const response = await POST(request("same.jpg"));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.mock).toBe(true);
    expect(result.weight.grams).toMatch(/^\d+\.\d{3}$/);
  });

  it("returns safe statuses for successful, low-confidence, malformed, timeout, and quota responses", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const responses = [
      JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"weightGrams":"126.000","purityPercent":"91.60","confidence":"high","readableText":"126.000 g"}' }] } }] }),
      JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"weightGrams":"126.000","purityPercent":"91.60","confidence":"low","readableText":"126.000 g"}' }] } }] }),
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }),
    ];
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(responses[0], { status: 200 }))
      .mockResolvedValueOnce(new Response(responses[1], { status: 200 }))
      .mockResolvedValueOnce(new Response(responses[2], { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }))
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { name: "AbortError" }))
      .mockResolvedValueOnce(new Response("quota", { status: 429 })));
    for (const [index, expected] of ["ok", "low_confidence", "unreadable", "unreadable", "unreadable", "unavailable", "unavailable"].entries()) {
      auth.mockResolvedValueOnce(session(`ai-user-${index}`));
      const response = await POST(request(`scale-${index}.jpg`));
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.status).toBe(expected);
      if (expected === "unreadable") expect(result.message).toContain("Could not read this photo clearly");
    }
  });

  it("rejects mismatched magic bytes and rate limits after ten requests", async () => {
    auth.mockResolvedValueOnce(session("bad-file"));
    const form = new FormData();
    form.append("image", new File(["not an image"], "bad.jpg", { type: "image/jpeg" }));
    expect((await POST(new Request("http://localhost/api/ai/read-scale", { method: "POST", body: form }))).status).toBe(422);
    process.env.AI_MOCK = "1";
    for (let index = 0; index < 11; index += 1) {
      auth.mockResolvedValueOnce(session("rate-user"));
      const response = await POST(request(`rate-${index}.jpg`));
      expect(response.status).toBe(index === 10 ? 429 : 200);
      if (index === 10) {
        expect(response.headers.get("Retry-After")).toBe("60");
        expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
      }
    }
  });
});
