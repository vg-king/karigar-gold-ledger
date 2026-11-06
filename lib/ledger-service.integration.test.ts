import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("../auth", () => ({ auth }));
import { prisma } from "./prisma";
import { calculateKarigarBalanceMg, createIssue, createReceipt, closeJob } from "./ledger-service";
import { recomputeLossAlerts } from "./alerts";
import { calculateStockStatement } from "./stock";
import { POST as postStockMovement } from "../app/api/stock/route";

const enabled = process.env.RUN_DB_TESTS === "1";
const describeDb = enabled ? describe : describe.skip;

describeDb("ledger service real database integration", () => {
  const suffix = `integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const actor = { id: "" };
  let karigarId = "";
  let categoryId = "";
  let jobId = "";
  const entryIds: string[] = [];
  let computeKarigarId = "";
  let stockKarigarId = "";
  let stockJobId = "";

  beforeAll(async () => {
    const clerk = await prisma.user.findUnique({ where: { email: "clerk@karigar-ledger.demo" } });
    if (!clerk) throw new Error("Seeded clerk user is required for database integration tests.");
    actor.id = clerk.id;
    const karigar = await prisma.karigar.create({
      data: { name: `Integration Karigar ${suffix}`, nameTa: "சோதனை", code: `IT-${suffix.slice(-8)}`, phone: "9000000099" },
    });

    karigarId = karigar.id;
    const category = await prisma.itemCategory.create({ data: { name: `integration-category-${suffix}`, wastageBp: 300 } });
    categoryId = category.id;
    await prisma.karigarCategoryRate.create({ data: { karigarId, categoryId, wastageBp: 300 } });
  });

  it("uses the real stock route for idempotent refiner movements", async () => {
    auth.mockResolvedValue({ user: { id: actor.id, role: "FINANCE_HEAD" } });
    const date = new Date().toISOString().slice(0, 10);
    const key = `route-${suffix}`;
    const body = { type: "REFINER_SEND", date, weight: "0.001", note: "route test", idempotencyKey: key };
    const first = await postStockMovement(new Request("http://localhost/api/stock", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
    expect(first.status).toBe(201);
    expect((await first.json()).movement.fineMg).toEqual({ mg: "1", grams: "0.001" });
    const replay = await postStockMovement(new Request("http://localhost/api/stock", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
    expect(replay.status).toBe(200);
    const returned = await postStockMovement(new Request("http://localhost/api/stock", { method: "POST", body: JSON.stringify({ ...body, type: "REFINER_RETURN", idempotencyKey: `${key}-return` }), headers: { "content-type": "application/json" } }));
    expect(returned.status).toBe(201);
    const conflict = await postStockMovement(new Request("http://localhost/api/stock", { method: "POST", body: JSON.stringify({ ...body, weight: "0.002" }), headers: { "content-type": "application/json" } }));
    expect(conflict.status).toBe(409);
    const overSend = await postStockMovement(new Request("http://localhost/api/stock", { method: "POST", body: JSON.stringify({ ...body, idempotencyKey: `${key}-over`, weight: "999999999.000" }), headers: { "content-type": "application/json" } }));
    expect(overSend.status).toBe(409);
    await prisma.stockMovement.deleteMany({ where: { idempotencyKey: { in: [key, `${key}-return`, `${key}-over`] } } });
  }, 15000);

  afterAll(async () => {
    if (karigarId) {
      if (computeKarigarId) await prisma.alert.deleteMany({ where: { karigarId: computeKarigarId } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: [karigarId, jobId, ...entryIds] } } });
      await prisma.ledgerEntry.deleteMany({ where: { karigarId } });
      await prisma.job.deleteMany({ where: { karigarId } });
      await prisma.karigarCategoryRate.deleteMany({ where: { karigarId } });
      await prisma.karigar.delete({ where: { id: karigarId } });
    }
    if (computeKarigarId) {
      await prisma.auditLog.deleteMany({ where: { entityId: computeKarigarId } });
      await prisma.ledgerEntry.deleteMany({ where: { karigarId: computeKarigarId } });
      await prisma.job.deleteMany({ where: { karigarId: computeKarigarId } });
      await prisma.karigar.delete({ where: { id: computeKarigarId } });
    }
    if (stockKarigarId) {
      await prisma.stockMovement.deleteMany({ where: { idempotencyKey: `stock-${suffix}` } });
      await prisma.ledgerEntry.deleteMany({ where: { karigarId: stockKarigarId } });
      await prisma.job.deleteMany({ where: { karigarId: stockKarigarId } });
      await prisma.karigar.delete({ where: { id: stockKarigarId } });
    }
    if (categoryId) {
      await prisma.itemCategory.delete({ where: { id: categoryId } });
    }
    await prisma.$disconnect();
  });

  it("runs issue, idempotency, receipt, rejection, close, and closed-job flows", async () => {
    const issue = await createIssue(prisma, actor, {
      karigarId,
      categoryId,
      grossWeight: "120.000",
      purity: "91.60",
      aiReadingMg: "120000",
      aiReadingPurityBp: 9160,
      aiResolution: "USED_AI",
      idempotencyKey: `${suffix}-issue`,
      jobNo: `IT-JOB-${suffix}`,
    });
    jobId = issue.entry.jobId;
    entryIds.push(issue.entry.id);
    expect(issue.status).toBe(201);
    expect(issue.entry.fine.mg).toBe("109920");
    const storedAi = await prisma.ledgerEntry.findUnique({ where: { id: issue.entry.id }, select: { aiReadingMg: true, aiReadingPurityBp: true, aiResolution: true } });
    expect(storedAi).toEqual({ aiReadingMg: 120000n, aiReadingPurityBp: 9160, aiResolution: "USED_AI" });

    const duplicate = await createIssue(prisma, actor, {
      karigarId,
      categoryId,
      grossWeight: "120.000",
      purity: "91.60",
      aiReadingMg: "120000",
      aiReadingPurityBp: 9160,
      aiResolution: "USED_AI",
      idempotencyKey: `${suffix}-issue`,
      jobNo: `IT-JOB-${suffix}`,
    });
    expect(duplicate.status).toBe(200);
    expect(duplicate.entry.id).toBe(issue.entry.id);

    await expect(createIssue(prisma, actor, {
      karigarId,
      categoryId,
      grossWeight: "121.000",
      purity: "91.60",
      idempotencyKey: `${suffix}-issue`,
      jobNo: `IT-JOB-${suffix}`,
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });

    const piece = await createReceipt(prisma, actor, {
      jobId,
      type: "RECEIPT_PIECE",
      grossWeight: "112.450",
      purity: "91.60",
      huid: `IT-HUID-${suffix}`,
      idempotencyKey: `${suffix}-piece`,
    });
    expect(piece.entry.fine.mg).toBe("103004");
    entryIds.push(piece.entry.id);

    const scrap = await createReceipt(prisma, actor, {
      jobId,
      type: "RECEIPT_SCRAP",
      grossWeight: "3.300",
      purity: "91.60",
      idempotencyKey: `${suffix}-scrap`,
    });
    expect(scrap.entry.fine.mg).toBe("3023");
    entryIds.push(scrap.entry.id);

    await expect(createReceipt(prisma, actor, {
      jobId,
      type: "RECEIPT_SCRAP",
      grossWeight: "10.000",
      purity: "100",
      idempotencyKey: `${suffix}-negative`,
    })).rejects.toMatchObject({ code: "NEGATIVE_BALANCE", status: 409 });

    const closed = await closeJob(prisma, actor, jobId);
    expect(closed.actualLoss.mg).toBe("3893");
    expect(closed.allowedWastage.mg).toBe("3298");
    expect(closed.lossBeyondAllowance.mg).toBe("595");

    await expect(createReceipt(prisma, actor, {
      jobId,
      type: "RECEIPT_SCRAP",
      grossWeight: "0.001",
      purity: "91.60",
      idempotencyKey: `${suffix}-closed`,
    })).rejects.toMatchObject({ code: "JOB_CLOSED", status: 409 });
  }, 15000);

  it("computes one idempotent alert for throwaway rising-loss jobs", async () => {
    const karigar = await prisma.karigar.create({
      data: { name: `Alert Integration ${suffix}`, code: `AI-${suffix.slice(-8)}`, phone: "9000000098" },
    });
    computeKarigarId = karigar.id;
    const losses = [79n, 139n, 229n, 340n];
    for (const [index, loss] of losses.entries()) {
      const job = await prisma.job.create({
        data: { jobNo: `AI-JOB-${suffix}-${index}`, karigarId: karigar.id, categoryId },
      });
      await prisma.job.update({ where: { id: job.id }, data: { status: "CLOSED" } });
      await prisma.ledgerEntry.createMany({
        data: [
          {
            type: "ISSUE", jobId: job.id, karigarId: karigar.id, grossMg: 100000n, purityBp: 10000,
            fineMg: 100000n, netMg: null, huid: null, idempotencyKey: `${suffix}-alert-issue-${index}`, createdById: actor.id,
          },
          {
            type: "RECEIPT_PIECE", jobId: job.id, karigarId: karigar.id, grossMg: 100000n - (100000n * loss) / 10000n,
            purityBp: 10000, fineMg: 100000n - (100000n * loss) / 10000n, netMg: null, huid: null,
            idempotencyKey: `${suffix}-alert-receipt-${index}`, createdById: actor.id,
          },
        ],
      });
    }
    expect((await recomputeLossAlerts(prisma)).created).toBe(1);
    expect((await recomputeLossAlerts(prisma)).created).toBe(0);
    expect(await prisma.alert.count({ where: { karigarId: computeKarigarId } })).toBe(1);
  }, 15000);

  it("reconciles a throwaway stock dataset from the real database", async () => {
    const karigar = await prisma.karigar.create({
      data: { name: `Stock Integration ${suffix}`, code: `SI-${suffix.slice(-8)}`, phone: "9000000097" },
    });
    stockKarigarId = karigar.id;
    const job = await prisma.job.create({ data: { jobNo: `SI-JOB-${suffix}`, karigarId: karigar.id, categoryId, status: "CLOSED", closedAt: new Date("2026-11-05T00:00:00.000Z"), createdAt: new Date("2026-11-04T00:00:00.000Z") } });
    stockJobId = job.id;
    const issue = await prisma.ledgerEntry.create({
      data: { type: "ISSUE", jobId: job.id, karigarId: karigar.id, grossMg: 1000n, purityBp: 10000, fineMg: 1000n, netMg: null, huid: null, idempotencyKey: `${suffix}-stock-issue`, createdById: actor.id, createdAt: new Date("2026-11-05T01:00:00.000Z") },
    });
    const receipt = await prisma.ledgerEntry.create({
      data: { type: "RECEIPT_PIECE", jobId: job.id, karigarId: karigar.id, grossMg: 900n, purityBp: 10000, fineMg: 900n, netMg: 900n, huid: "STOCK-HUID", idempotencyKey: `${suffix}-stock-receipt`, createdById: actor.id, createdAt: new Date("2026-11-05T02:00:00.000Z") },
    });
    const opening = await prisma.stockMovement.create({
      data: { type: "OPENING", movementDate: new Date("2026-11-04T00:00:00.000Z"), fineMg: 1000n, note: "test opening", idempotencyKey: `stock-${suffix}`, createdById: actor.id },
    });
    const statement = calculateStockStatement(
      [{ type: opening.type, movementDate: opening.movementDate, fineMg: opening.fineMg, note: opening.note }],
      [issue, receipt].map((entry) => ({ type: entry.type, fineMg: entry.fineMg, createdAt: entry.createdAt, jobId: entry.jobId, karigarId: entry.karigarId })),
      [{ ...job, karigarName: karigar.name, ledgerEntries: [issue, receipt].map((entry) => ({ type: entry.type, fineMg: entry.fineMg, createdAt: entry.createdAt, jobId: entry.jobId, karigarId: entry.karigarId })) }],
      new Date("2026-11-05T00:00:00.000Z"),
    );
    expect(statement.reconciled).toBe(true);
    expect(statement.writtenOffMg).toBe(100n);
    expect(calculateKarigarBalanceMg([{ ...job, status: job.status, ledgerEntries: [issue, receipt] }])).toBe(statement.withKarigarsMg);
    expect(calculateKarigarBalanceMg([{ ...job, status: job.status, ledgerEntries: [issue, receipt] }]) + statement.writtenOffMg).toBe(100n);
    expect(stockJobId).toBe(job.id);
  }, 15000);
});
