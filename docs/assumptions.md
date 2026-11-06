# Design assumptions

## Loss drift

Drift uses the **population standard deviation** of the earlier closed jobs for
the same karigar, with a **20 bp floor**. An alert is raised when **z >= 2**
and the latest loss is **at least 50 bp above the mean**.

## Daily stock statement

- **A-S1:** The statement answers where all fine gold is at the end of a chosen date: vault, with karigars, at refiner, and written-off wastage.
- **A-S2:** Vault-level movements are OPENING, REFINER_SEND, and REFINER_RETURN. Ledger entries cover issues and receipts.
- **A-S3:** All stock arithmetic uses integer BigInt milligrams. Open-job balances, closed-job losses, refiner balance, and vault balance reconcile back to opening stock.

## Karigar balance

The canonical karigar balance is the sum of `(issued fine - received fine)` for
jobs open at the requested as-of date. Closed-job leftovers are written-off
loss and are never included in the balance.

## Step 6 AI scale reading

- The Gemini call uses the official `generateContent` REST endpoint with inline image data. `GEMINI_MODEL` is configurable; the default is the current budget multimodal model documented by Google, `gemini-3.5-flash-lite`.
- If `GEMINI_API_KEY` is absent or `AI_MOCK=1`, the server returns a deterministic demo reading derived from the image name and byte size. This is explicitly marked as mock and is not a measurement.
- The server keeps image bytes only for the request. It does not log the key, image bytes, or model response.
- Photo rate limiting is an in-memory limit of 10 requests per user per minute. It is per process and must be replaced with shared storage for a multi-instance deployment.
