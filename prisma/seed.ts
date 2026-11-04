import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { fineMg, formatMg, parseWeightToMg } from "../lib/gold";

// Demo-only credentials. Do not use these passwords outside local development.
const DEMO_CLERK_PASSWORD = "Clerk@Demo2026";
const DEMO_FINANCE_PASSWORD = "Finance@Demo2026";

const karigars = [
  ["Murugesan S", "முருகேசன் S", "KRG-001", "9000000001"],
  ["Lakshmi Devi", "லட்சுமி தேவி", "KRG-002", "9000000002"],
  ["Arun Kumar", "அருண் குமார்", "KRG-003", "9000000003"],
  ["Meenakshi R", "மீனாட்சி R", "KRG-004", "9000000004"],
  ["Selvam P", "செல்வம் P", "KRG-005", "9000000005"],
  ["Priya Nair", "பிரியா நாயர்", "KRG-006", "9000000006"],
  ["Ravi Shankar", "ரவி சங்கர்", "KRG-007", "9000000007"],
  ["Kannan Vel", "கண்ணன் வேல்", "KRG-008", "9000000008"],
] as const;

const categories = [
  ["chain", 250],
  ["necklace", 300],
  ["bangle", 350],
  ["ring", 200],
  ["earring", 400],
] as const;

const receiptTypes = ["RECEIPT_PIECE", "RECEIPT_SCRAP", "RECEIPT_FILINGS"] as const;
const purityBp = 9160n;

type SeedEntry = {
  type: "ISSUE" | typeof receiptTypes[number];
  jobId: string;
  karigarId: string;
  grossMg: bigint;
  purityBp: number;
  fineMg: bigint;
  netMg: bigint | null;
  huid: string | null;
  idempotencyKey: string;
  createdById: string;
  createdAt: Date;
};

function daysAgo(days: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date;
}

function toFine(grossMg: bigint): bigint {
  return fineMg(grossMg, purityBp);
}

function receiptGrosses(issueGrossMg: bigint, lossBp: number): bigint[] {
  const lossMg = (issueGrossMg * BigInt(lossBp)) / 10000n;
  const receivedMg = issueGrossMg - lossMg;
  const pieceMg = (receivedMg * 80n) / 100n;
  const scrapMg = (receivedMg * 15n) / 100n;
  return [pieceMg, scrapMg, receivedMg - pieceMg - scrapMg];
}

function assertBalances(entries: SeedEntry[], karigarIds: string[]): void {
  for (const karigarId of karigarIds) {
    let balance = 0n;
    const karigarEntries = entries
      .filter((entry) => entry.karigarId === karigarId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

    for (const entry of karigarEntries) {
      balance += entry.type === "ISSUE" ? entry.fineMg : -entry.fineMg;
      if (balance < 0n) {
        throw new Error(`Seed balance went negative for karigar ${karigarId} at ${entry.idempotencyKey}.`);
      }
    }
  }
}

function lossPercent(entries: SeedEntry[]): string {
  const issued = entries
    .filter((entry) => entry.type === "ISSUE")
    .reduce((sum, entry) => sum + entry.fineMg, 0n);
  const received = entries
    .filter((entry) => entry.type !== "ISSUE")
    .reduce((sum, entry) => sum + entry.fineMg, 0n);
  if (issued === 0n) {
    return "0.00%";
  }
  const lossBp = ((issued - received) * 10000n) / issued;
  return `${lossBp / 100n}.${(lossBp % 100n).toString().padStart(2, "0")}%`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before running the seed.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const [clerkPasswordHash, financePasswordHash] = await Promise.all([
      bcrypt.hash(DEMO_CLERK_PASSWORD, 12),
      bcrypt.hash(DEMO_FINANCE_PASSWORD, 12),
    ]);
    const clerk = await prisma.user.upsert({
      where: { email: "clerk@karigar-ledger.demo" },
      update: { passwordHash: clerkPasswordHash },
      create: {
        email: "clerk@karigar-ledger.demo",
        name: "Demo Issue Clerk",
        role: "ISSUE_CLERK",
        passwordHash: clerkPasswordHash,
      },
    });
    const financeHead = await prisma.user.upsert({
      where: { email: "finance@karigar-ledger.demo" },
      update: { passwordHash: financePasswordHash },
      create: {
        email: "finance@karigar-ledger.demo",
        name: "Demo Finance Head",
        role: "FINANCE_HEAD",
        passwordHash: financePasswordHash,
      },
    });

    await prisma.auditLog.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.job.deleteMany();
    await prisma.karigarCategoryRate.deleteMany();
    await prisma.itemCategory.deleteMany();
    await prisma.karigar.deleteMany();

    const categoryRows = await Promise.all(categories.map(([name, wastageBp]) =>
      prisma.itemCategory.create({ data: { name, wastageBp } }),
    ));
    const karigarRows = await Promise.all(karigars.map(([name, nameTa, code, phone]) =>
      prisma.karigar.create({ data: { name, nameTa, code, phone } }),
    ));

    for (const [karigarIndex, karigar] of karigarRows.entries()) {
      for (const [categoryIndex, category] of categoryRows.entries()) {
        const baseRate = categories[categoryIndex][1];
        const offset = karigarIndex === 0 && categoryIndex === 1
          ? 0
          : ((karigarIndex + categoryIndex) % 5 - 2) * 25;
        await prisma.karigarCategoryRate.create({
          data: {
            karigarId: karigar.id,
            categoryId: category.id,
            wastageBp: baseRate + offset,
          },
        });
      }
    }

    const jobs: Array<{ id: string; karigarId: string; status: "OPEN" | "CLOSED"; jobNo: string }> = [];
    for (const [karigarIndex, karigar] of karigarRows.entries()) {
      for (let jobIndex = 0; jobIndex < 4; jobIndex += 1) {
        const categoryIndex = karigarIndex === 0 && jobIndex === 0 ? 1 : (karigarIndex + jobIndex) % categoryRows.length;
        const job = await prisma.job.create({
          data: {
            jobNo: karigarIndex === 0 && jobIndex === 0
              ? "J-1042"
              : `J-${2000 + karigarIndex * 10 + jobIndex}`,
            karigarId: karigar.id,
            categoryId: categoryRows[categoryIndex].id,
            status: karigarIndex === 0 && jobIndex === 0 ? "OPEN" : "CLOSED",
          },
        });
        jobs.push({ id: job.id, karigarId: job.karigarId, status: job.status, jobNo: job.jobNo });
      }
    }

    const entries: SeedEntry[] = [];
    const closedLosses = [80, 110, 125, 95, 105, 90, 115, 100];
    for (const [jobIndex, job] of jobs.entries()) {
      const karigarIndex = Math.floor(jobIndex / 4);
      const localJobIndex = jobIndex % 4;
      const isSample = karigarIndex === 0 && localJobIndex === 0;
      const issueGrossMg = isSample
        ? parseWeightToMg("120.000")
        : parseWeightToMg(`${100 + karigarIndex * 4 + localJobIndex * 2}.000`);
      const lossBp = karigarIndex === 1 || karigarIndex === 3
        ? [80, 140, 230, 340][localJobIndex]
        : closedLosses[karigarIndex];
      const issueDate = daysAgo(29 - jobIndex % 28, 8 + (jobIndex % 4));
      const issueFineMg = toFine(issueGrossMg);

      entries.push({
        type: "ISSUE",
        jobId: job.id,
        karigarId: job.karigarId,
        grossMg: issueGrossMg,
        purityBp: Number(purityBp),
        fineMg: issueFineMg,
        netMg: null,
        huid: `HUID-${String(jobIndex + 1).padStart(4, "0")}`,
        idempotencyKey: `seed-issue-${jobIndex}`,
        createdById: clerk.id,
        createdAt: issueDate,
      });

      if (isSample) {
        const sampleReceipts = ["112.450", "3.300"];
        for (const [receiptIndex, gross] of sampleReceipts.entries()) {
          const grossMg = parseWeightToMg(gross);
          entries.push({
            type: receiptIndex === 0 ? "RECEIPT_PIECE" : "RECEIPT_SCRAP",
            jobId: job.id,
            karigarId: job.karigarId,
            grossMg,
            purityBp: Number(purityBp),
            fineMg: toFine(grossMg),
            netMg: grossMg,
            huid: null,
            idempotencyKey: `seed-sample-receipt-${receiptIndex}`,
            createdById: clerk.id,
            createdAt: daysAgo(28 - receiptIndex, 13 + receiptIndex),
          });
        }
        continue;
      }

      for (const [receiptIndex, grossMg] of receiptGrosses(issueGrossMg, lossBp).entries()) {
        entries.push({
          type: receiptTypes[receiptIndex],
          jobId: job.id,
          karigarId: job.karigarId,
          grossMg,
          purityBp: Number(purityBp),
          fineMg: toFine(grossMg),
          netMg: grossMg,
          huid: null,
          idempotencyKey: `seed-receipt-${jobIndex}-${receiptIndex}`,
          createdById: clerk.id,
          createdAt: new Date(issueDate.getTime() + (receiptIndex + 1) * 60 * 60 * 1000),
        });
      }
    }

    for (let karigarIndex = 0; karigarIndex < 5; karigarIndex += 1) {
      const karigar = karigarRows[karigarIndex];
      const category = categoryRows[(karigarIndex + 2) % categoryRows.length];
      const job = await prisma.job.create({
        data: {
          jobNo: `J-${3000 + karigarIndex}`,
          karigarId: karigar.id,
          categoryId: category.id,
          status: "OPEN",
        },
      });
      jobs.push({ id: job.id, karigarId: job.karigarId, status: job.status, jobNo: job.jobNo });
      const issueGrossMg = parseWeightToMg(`${88 + karigarIndex * 3}.000`);
      const issueFineMg = toFine(issueGrossMg);
      const issueDate = karigarIndex < 3 ? new Date() : daysAgo(1, 10 + karigarIndex);
      entries.push({
        type: "ISSUE",
        jobId: job.id,
        karigarId: karigar.id,
        grossMg: issueGrossMg,
        purityBp: Number(purityBp),
        fineMg: issueFineMg,
        netMg: null,
        huid: `HUID-OPEN-${karigarIndex + 1}`,
        idempotencyKey: `seed-open-issue-${karigarIndex}`,
        createdById: clerk.id,
        createdAt: issueDate,
      });
      const partialGrossMg = (issueGrossMg * 45n) / 100n;
      entries.push({
        type: "RECEIPT_PIECE",
        jobId: job.id,
        karigarId: karigar.id,
        grossMg: partialGrossMg,
        purityBp: Number(purityBp),
        fineMg: toFine(partialGrossMg),
        netMg: partialGrossMg,
        huid: `HUID-OPEN-PIECE-${karigarIndex + 1}`,
        idempotencyKey: `seed-open-receipt-${karigarIndex}`,
        createdById: clerk.id,
        createdAt: new Date(issueDate.getTime() + 60 * 60 * 1000),
      });
    }

    assertBalances(entries, karigarRows.map((karigar) => karigar.id));
    await prisma.ledgerEntry.createMany({ data: entries });

    await prisma.auditLog.create({
      data: {
        action: "SEED_DATA_CREATED",
        entity: "DATABASE",
        detail: "Created demo users, master data, jobs, and ledger entries.",
        actorId: financeHead.id,
      },
    });

    console.log(`Seeded ${karigarRows.length} karigars, ${categoryRows.length} categories, ${jobs.length} jobs, and ${entries.length} ledger entries.`);
    for (const karigar of karigarRows) {
      const karigarEntries = entries.filter((entry) => entry.karigarId === karigar.id);
      const balance = karigarEntries.reduce(
        (sum, entry) => sum + (entry.type === "ISSUE" ? entry.fineMg : -entry.fineMg),
        0n,
      );
      const closedLossesForKarigar = [];
      for (const job of jobs.filter((item) => item.karigarId === karigar.id && item.status === "CLOSED")) {
        const jobEntries = karigarEntries.filter((entry) => entry.jobId === job.id);
        closedLossesForKarigar.push(lossPercent(jobEntries));
      }
      console.log(`${karigar.name}: ${jobs.filter((item) => item.karigarId === karigar.id).length} jobs, ${formatMg(balance)} g final balance, closed loss ${closedLossesForKarigar.join(", ")}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
