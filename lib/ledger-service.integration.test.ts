import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { createIssue, createReceipt, closeJob } from "./ledger-service";

const enabled = process.env.RUN_DB_TESTS === "1";
const describeDb = enabled ? describe : describe.skip;

describeDb("ledger service real database integration", () => {
  const suffix = `integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const actor = { id: "" };
  let karigarId = "";
  let categoryId = "";
  let jobId = "";
  const entryIds: string[] = [];

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

  afterAll(async () => {
    if (karigarId) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: [karigarId, jobId, ...entryIds] } } });
      await prisma.ledgerEntry.deleteMany({ where: { karigarId } });
      await prisma.job.deleteMany({ where: { karigarId } });
      await prisma.karigarCategoryRate.deleteMany({ where: { karigarId } });
      await prisma.karigar.delete({ where: { id: karigarId } });
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
      idempotencyKey: `${suffix}-issue`,
      jobNo: `IT-JOB-${suffix}`,
    });
    jobId = issue.entry.jobId;
    entryIds.push(issue.entry.id);
    expect(issue.status).toBe(201);
    expect(issue.entry.fine.mg).toBe("109920");

    const duplicate = await createIssue(prisma, actor, {
      karigarId,
      categoryId,
      grossWeight: "120.000",
      purity: "91.60",
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
  });
});
