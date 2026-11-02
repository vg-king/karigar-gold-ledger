# Karigar Gold Ledger (isocodelabs screening)
Users: issue_clerk, finance_head (roles, server-side checks). Karigars: view-only phone link.
Stack: Next.js App Router, TS, Tailwind, Prisma, Postgres, Auth.js, Zod, Vitest.

## Gold maths (NON-NEGOTIABLE)
- Weights stored as integer milligrams (BIGINT). Purity as basis points (91.60% = 9160).
- fine_mg = round_half_up(gross_mg * purity_bp / 10000)
- All maths in ONE module: lib/gold.ts. No floats anywhere else. Display = 3 decimals.
- Running balance per karigar = sum(issue fine) - sum(receipt fine: pieces + scrap + filings)
- Assumption A1: allowed wastage = issued fine * allowed_pct(category). Loss beyond allowance = balance - allowance when job closed.
- Assumption A2: sample data shows 3.8935; we round to 3.893 (3 decimals rule).

## Core screens
1 Login  2 Karigar master (wastage % per category)  3 Issue entry + slip
4 Receipt entry (piece/scrap/filings) with allowed vs actual  5 Karigar balances + job ledger
6 Loss alerts (finance head only)  7 Daily stock statement (+CSV export)

## AI part
Photo of scale display -> LLM extracts weight/purity -> shown BESIDE photo,
clerk confirms. If typed value != AI value, saving is BLOCKED until resolved.
If AI unsure/fails -> manual entry, app never breaks.
Alerts: karigar loss % vs own history (z-score). Wording: "review item", never accusation.

## Quality bars
Zod validation on every API, role checks server-side, no secrets in repo,
loading/empty/error states, mobile-first, aligned decimals (tabular-nums).
Offline: queue entries in IndexedDB, sync with idempotency key.