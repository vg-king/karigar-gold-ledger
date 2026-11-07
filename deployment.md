# Deployment & Operations Guide

## 1. Live App & Demo Logins

- **Live URL:** [https://karigar-gold-ledger.vercel.app](https://karigar-gold-ledger.vercel.app)

### Demo Credentials
Defined as constants in [`prisma/seed.ts`](file:///c:/Users/KIIT0001/Documents/Assignment_ISOCODELABS/karigar-gold-ledger/prisma/seed.ts#L10-L11):

| Role | Email | Password | Accessible Screens |
| :--- | :--- | :--- | :--- |
| **Issue Clerk** (`ISSUE_CLERK`) | `clerk@karigar-ledger.demo` | `Clerk@Demo2026` | Home (`/`), Balances (`/balances`), Karigar Ledger (`/karigars/[id]`), Issue Gold (`/issue`), Receipt (`/receipt`), Issue Slip (`/slips/[entryId]`). Opening `/finance`, `/stock`, or `/karigars` yields a 403 Access Denied. |
| **Finance Head** (`FINANCE_HEAD`) | `finance@karigar-ledger.demo` | `Finance@Demo2026` | All clerk screens, plus Karigar Master (`/karigars`), Loss Review Items (`/finance`), and Daily Stock Statement (`/stock`). |

> **Note on Login Lockout:** Accounts and client IPs are temporarily locked out for 15 minutes after 5 consecutive failed login attempts (`lib/auth-rate-limit.ts`).

---

## 2. Run Locally, Step by Step

### Prerequisites
- **Node.js:** Node.js 20+ LTS (project uses `@types/node: ^20` and Next.js 16).
- **PostgreSQL Database:** A PostgreSQL instance, such as a free-tier [Neon](https://neon.tech) database.

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd karigar-gold-ledger
```

### Step 2: Install Dependencies
```bash
npm install
```
*(Runs `postinstall: prisma generate` automatically to generate the Prisma client).*

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:

- **Windows PowerShell:**
  ```powershell
  Copy-Item .env.example .env
  ```
- **macOS / Linux:**
  ```bash
  cp .env.example .env
  ```

Open `.env` and configure:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `AUTH_SECRET`: Generate a secure random string (e.g. `npx auth secret` or `openssl rand -base64 33`).
- Optionally add `GEMINI_API_KEY`, or set `AI_MOCK=1` for offline testing.

### Step 4: Apply Database Migrations
```bash
npx prisma migrate deploy
```

### Step 5: Seed Demo Data
```bash
npm run db:seed
```

### Step 6: Start Development Server
```bash
npm run dev
```

### Step 7: Open in Browser
Visit [http://localhost:3000](http://localhost:3000).

---

## 3. Environment Variables

| Variable Name | Status | Purpose | Example Format |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection string used by Prisma client and seed script. | `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require` |
| `AUTH_SECRET` | **Required** | Secret key for Auth.js to encrypt session tokens and cookies. Generated via `npx auth secret` or `openssl rand -base64 33`. | `32+_character_random_string` |
| `AUTH_TRUST_HOST` | Optional | Set to `true` in proxy/serverless environments (like Vercel) to trust host headers. | `true` |
| `GEMINI_API_KEY` | Optional | Google Gemini API key used by `/api/ai/read-scale` to read scale displays. | `AIzaSy...` |
| `GEMINI_MODEL` | Optional | Multimodal Gemini model name. Defaults to `gemini-3.5-flash-lite` if unset. | `gemini-3.5-flash-lite` |
| `AI_MOCK` | Optional | When set to `"1"`, scale reading returns deterministic mock data without calling Gemini. | `1` or `0` |
| `RUN_DB_TESTS` | Optional | Enables real-database integration tests in Vitest when set to `"1"`. | `1` |
| `NODE_ENV` | Optional | Standard environment indicator (`development`, `production`, `test`). | `production` |

---

## 4. AI Scale Reader Modes

The scale reader (`/api/ai/read-scale`) operates in three modes:
1. **With API Key (`GEMINI_API_KEY` set, `AI_MOCK` not `1`):** Calls the Gemini `generateContent` REST endpoint using `GEMINI_MODEL` (default: `gemini-3.5-flash-lite`). Returns extracted gross weight, purity percentage, and confidence level. The reading is shown beside the photo; if typed values differ, saving is blocked until the clerk chooses *Use this reading* or *Keep typed*.
2. **With `AI_MOCK=1`:** Bypasses external network calls and generates a deterministic demo reading derived from the image filename and byte size. Displays a *"Demo reading (no AI key configured)"* indicator.
3. **Without API Key (`GEMINI_API_KEY` unset and `AI_MOCK=0`):** Returns `{ status: "unavailable" }`. The app never crashes, and clerks proceed with standard manual weight and purity entry.

---

## 5. Testing & Verification

- **Unit & Route Tests:**
  ```bash
  npm test
  ```
  Runs Vitest unit tests in memory (65 passed across gold arithmetic, validation schemas, stock math, auth, and API routes).
- **Real Database Integration Tests:**
  ```bash
  npm run test:db
  ```
  Runs `lib/ledger-service.integration.test.ts` (4 passed). Needs `DATABASE_URL` with seed data (requires clerk user). It creates temporary records with a unique random suffix (`integration-<timestamp>-<hash>`) and deletes them in `afterAll`, leaving seed data untouched.
- **Lint:**
  ```bash
  npm run lint
  ```
- **Type-Check:**
  ```bash
  npx tsc --noEmit
  ```
- **Production Build:**
  ```bash
  npm run build
  ```

---

## 6. Deployment Architecture (Vercel + Neon)

- **Platform:** Vercel project connected to the GitHub repository.
- **Database:** Neon Serverless PostgreSQL (maintain a dedicated production branch/database for live deployments).
- **Environment Variables:** Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, and `GEMINI_API_KEY` in Vercel Project Settings.
- **Build Hook:** `package.json` defines `"postinstall": "prisma generate"`, ensuring the Prisma client is compiled automatically on Vercel builds before `next build` runs.
- **Database Migrations:** Run migrations manually before pushing schema-dependent code:
  ```bash
  npx prisma migrate deploy
  ```
- **Seeding Policy:** Run `npm run db:seed` only deliberately. The seed script executes `deleteMany()` across all transactional tables, wiping existing data to create fresh demo fixtures.

---

## 7. Known Operational Limitations

1. **Database Cold Starts:** Free-tier Neon Postgres instances pause compute after inactivity. The first request after a sleep period may take a few seconds while compute resumes.
2. **In-Memory Rate Limiters:** Login lockouts (`lib/auth-rate-limit.ts`, 5 attempts / 15 min) and scale photo limits (`app/api/ai/read-scale/route.ts`, 10 req / min) use process-level in-memory maps. In horizontally scaled multi-instance deployments, distributed caching (e.g. Redis) is needed for shared tracking across instances.
3. **Destructive Seeding:** `npm run db:seed` completely resets all jobs, ledger entries, karigars, and stock history. Never execute seed against a live production database with real data.

