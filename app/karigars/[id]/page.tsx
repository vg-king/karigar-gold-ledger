import { notFound } from "next/navigation";
import { requireRole } from "../../../lib/require-role";
import { getKarigarBalance, getKarigarLedger } from "../../../lib/ledger-service";
import { prisma } from "../../../lib/prisma";
import { AppShell } from "../../../components/app-shell";
import { Badge, Card, EmptyState, PageHeader } from "../../../components/ui";
import { LedgerPager } from "../../../components/ledger-pager";

export default async function KarigarLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  const { id } = await params;
  const exists = await prisma.karigar.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();
  const [summary, ledger] = await Promise.all([getKarigarBalance(prisma, id), getKarigarLedger(prisma, id, 1, 25)]);
  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow={summary.karigar.code} title={summary.karigar.name} description="Fine gold balance and job history." /><Card className="balance-hero"><p className="metric-label">Outstanding fine balance</p><p className="hero-number gold-number">{summary.balance.grams}<span> g</span></p><p className="muted">{summary.balance.mg} mg · {summary.openJobs.length} open jobs</p></Card><Card><div className="card-heading"><div><p className="eyebrow">Open work</p><h2>Job wastage review</h2></div></div>{summary.openJobs.length ? <div className="job-list">{summary.openJobs.map((job) => <div className="job-row" key={job.jobId}><span><strong>{job.jobNo}</strong><small>Actual loss vs agreed allowance</small></span><span className="row-meta"><span className="gold-number">{job.actualLoss.grams} g / {job.allowedWastage.grams} g</span><Badge>Review item</Badge></span></div>)}</div> : <EmptyState title="No open jobs" message="Closed work will remain in the ledger below." />}</Card><Card><div className="card-heading"><div><p className="eyebrow">Entries</p><h2>Ledger history</h2></div></div><LedgerPager karigarId={id} initial={ledger} /></Card></div></AppShell>;
}
