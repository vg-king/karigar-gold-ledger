import { notFound } from "next/navigation";
import { requireRole } from "../../../lib/require-role";
import { prisma } from "../../../lib/prisma";
import { serializeWeight } from "../../../lib/api";
import { runningBalanceMg } from "../../../lib/gold";
import { PrintButton } from "../../../components/print-button";

export const dynamic = "force-dynamic";

export default async function SlipPage({ params }: { params: Promise<{ entryId: string }> }) {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  const { entryId } = await params;
  const entry = await prisma.ledgerEntry.findUnique({ where: { id: entryId }, include: { job: { include: { category: true } }, karigar: true } });
  if (!entry) notFound();
  const [jobEntries, karigarEntries] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { jobId: entry.jobId }, orderBy: { createdAt: "asc" }, select: { type: true, fineMg: true } }),
    prisma.ledgerEntry.findMany({ where: { karigarId: entry.karigarId }, orderBy: { createdAt: "asc" }, select: { type: true, fineMg: true } }),
  ]);
  const balance = runningBalanceMg(jobEntries.map((item) => ({ type: item.type, fineMg: item.fineMg })));
  const karigarBalance = runningBalanceMg(karigarEntries.map((item) => ({ type: item.type, fineMg: item.fineMg })));
  const gross = serializeWeight(entry.grossMg);
  const fine = serializeWeight(entry.fineMg);
  return <main className="slip-page"><article className="slip-card surface"><p className="eyebrow">Karigar Gold Ledger</p><h1>Issue slip</h1><div className="slip-meta"><span>Job <strong>{entry.job.jobNo}</strong></span><span>{entry.createdAt.toLocaleDateString()}</span></div><dl><div><dt>Karigar</dt><dd>{entry.karigar.name} ({entry.karigar.code})</dd></div><div><dt>Item category</dt><dd>{entry.job.category.name}</dd></div><div><dt>Gross weight</dt><dd>{gross.grams} g</dd></div><div><dt>Purity</dt><dd>{(entry.purityBp / 100).toFixed(2)}%</dd></div><div><dt>Fine weight</dt><dd>{fine.grams} g</dd></div><div><dt>Job balance</dt><dd>{serializeWeight(balance).grams} g</dd></div><div><dt>Karigar total balance</dt><dd>{serializeWeight(karigarBalance).grams} g</dd></div></dl><div className="signature-line"><span>Received by</span><span>Date</span></div><PrintButton /></article></main>;
}
