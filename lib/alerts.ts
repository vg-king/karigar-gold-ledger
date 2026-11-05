import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { lossBp, allowedWastageMg } from "./gold";
import { evaluateDrift } from "./drift";
import { serializeWeight } from "./api";

type AlertDb = PrismaClient | Prisma.TransactionClient;

type ClosedJob = {
  id: string;
  jobNo: string;
  karigarId: string;
  createdAt: Date;
  category: { wastageBp: number };
  karigar: { id: string; name: string };
  ledgerEntries: Array<{ type: string; fineMg: bigint }>;
};

function jobMetrics(job: ClosedJob) {
  const issuedFineMg = job.ledgerEntries.filter((entry) => entry.type === "ISSUE").reduce((sum, entry) => sum + entry.fineMg, 0n);
  const receivedFineMg = job.ledgerEntries.filter((entry) => entry.type !== "ISSUE").reduce((sum, entry) => sum + entry.fineMg, 0n);
  const actualLossMg = issuedFineMg - receivedFineMg;
  return {
    issuedFineMg,
    receivedFineMg,
    actualLossMg,
    lossBp: Number(lossBp(issuedFineMg, receivedFineMg)),
    allowedWastageMg: allowedWastageMg(issuedFineMg, BigInt(job.category.wastageBp)),
  };
}

export async function recomputeLossAlerts(db: AlertDb) {
  const jobs = await db.job.findMany({
    where: { status: "CLOSED" },
    orderBy: { createdAt: "asc" },
    include: { category: true, karigar: true, ledgerEntries: true },
  }) as ClosedJob[];
  const byKarigar = new Map<string, ClosedJob[]>();
  for (const job of jobs) {
    const list = byKarigar.get(job.karigarId) ?? [];
    list.push(job);
    byKarigar.set(job.karigarId, list);
  }
  let created = 0;
  for (const karigarJobs of byKarigar.values()) {
    const latest = karigarJobs[karigarJobs.length - 1];
    if (!latest) continue;
    const prior = karigarJobs.slice(0, -1).map((job) => jobMetrics(job).lossBp);
    const latestMetrics = jobMetrics(latest);
    const drift = evaluateDrift(prior, latestMetrics.lossBp);
    if (!drift.alert) continue;
    const existing = await db.alert.findUnique({ where: { dedupeKey: `${latest.karigarId}:${latest.id}` } });
    await db.alert.upsert({
      where: { dedupeKey: `${latest.karigarId}:${latest.id}` },
      update: {},
      create: {
        karigarId: latest.karigarId,
        jobId: latest.id,
        kind: "LOSS_REVIEW",
        dedupeKey: `${latest.karigarId}:${latest.id}`,
        detail: "Review item: recent loss rate is above this karigar's own history",
      },
    });
    if (!existing) created += 1;
  }
  return { created };
}

export async function getLossAlerts(db: AlertDb) {
  await recomputeLossAlerts(db);
  const alerts = await db.alert.findMany({
    where: { kind: "LOSS_REVIEW" },
    orderBy: { createdAt: "desc" },
    include: {
      karigar: true,
      job: { include: { category: true, ledgerEntries: true } },
    },
  });
  const allJobs = await db.job.findMany({
    where: { status: "CLOSED" },
    orderBy: { createdAt: "asc" },
    include: { category: true, karigar: true, ledgerEntries: true },
  }) as ClosedJob[];
  return alerts.map((alert) => {
    const history = allJobs.filter((job) => job.karigarId === alert.karigarId);
    const latest = history.find((job) => job.id === alert.jobId);
    const latestMetrics = latest ? jobMetrics(latest) : jobMetrics({
      ...alert.job,
      karigarId: alert.karigarId,
      createdAt: alert.createdAt,
      karigar: { id: alert.karigar.id, name: alert.karigar.name },
    });
    const prior = history.filter((job) => job.createdAt < (latest?.createdAt ?? new Date())).map((job) => jobMetrics(job).lossBp);
    const drift = evaluateDrift(prior, latestMetrics.lossBp);
    return {
      id: alert.id,
      status: alert.status,
      detail: alert.detail,
      createdAt: alert.createdAt.toISOString(),
      karigar: { id: alert.karigar.id, name: alert.karigar.name },
      job: { id: alert.job.id, jobNo: alert.job.jobNo },
      latestLossBp: latestMetrics.lossBp,
      latestLossPercent: (latestMetrics.lossBp / 100).toFixed(2),
      meanBp: drift.meanBp,
      meanPercent: (drift.meanBp / 100).toFixed(2),
      standardDeviationBp: drift.standardDeviationBp,
      standardDeviationPercent: (drift.standardDeviationBp / 100).toFixed(2),
      zScore: drift.zScore,
      jobsCompared: drift.jobsCompared,
      allowedWastage: serializeWeight(latestMetrics.allowedWastageMg),
      actualLoss: serializeWeight(latestMetrics.actualLossMg),
      series: history.map((job) => {
        const metrics = jobMetrics(job);
        return { jobNo: job.jobNo, lossBp: metrics.lossBp, lossPercent: (metrics.lossBp / 100).toFixed(2) };
      }),
    };
  });
}

export async function reviewLossAlert(db: AlertDb, actorId: string, alertId: string, reviewNote?: string | null) {
  return db.$transaction(async (tx) => {
    const alert = await tx.alert.update({
      where: { id: alertId },
      data: { status: "REVIEWED", reviewedById: actorId, reviewedAt: new Date(), reviewNote: reviewNote ?? null },
    });
    await tx.auditLog.create({
      data: {
        action: "REVIEW",
        entity: "ALERT",
        entityId: alert.id,
        detail: reviewNote ? `Marked loss review item as reviewed: ${reviewNote}` : "Marked loss review item as reviewed.",
        actorId,
      },
    });
    return alert;
  });
}
