export async function fetchReadWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (attempt === 1) throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw new Error("Read request failed.");
}
