import { notFound } from "next/navigation";
import { requireRole } from "../../../lib/require-role";
import { getKarigarBalance, getKarigarLedger } from "../../../lib/ledger-service";
import { prisma } from "../../../lib/prisma";
import { AppShell } from "../../../components/app-shell";
import { Card, EmptyState, PageHeader } from "../../../components/ui";
import { LedgerPager } from "../../../components/ledger-pager";
import { pluralizeCount } from "../../../lib/counts";

export default async function KarigarLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  const { id } = await params;
  const exists = await prisma.karigar.findUnique({ where: { id }, select: { id: true } });
  if (!exists) notFound();
  const [summary, ledger] = await Promise.all([getKarigarBalance(prisma, id), getKarigarLedger(prisma, id, 1, 25)]);
  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow={summary.karigar.code} title={summary.karigar.name} description="Fine gold balance and job history." /><Card className="balance-hero"><p className="metric-label">Outstanding fine balance</p><p className="hero-number gold-number">{summary.balance.grams}<span> g</span></p><p className="muted">{pluralizeCount(summary.openJobs.length, "open job")}</p></Card><Card><div className="card-heading"><div><p className="eyebrow">Open work</p><h2>Current jobs</h2></div></div>{summary.openJobs.length ? <div className="job-list">{summary.openJobs.map((job) => <div className="job-row" key={job.jobId}><span><strong>{job.jobNo}</strong><small>Issued · Received so far · Outstanding · Allowed wastage</small></span><span className="row-meta"><span className="gold-number">{job.balance.grams} g outstanding</span><span className="muted">Allowed {job.allowedWastage.grams} g</span></span></div>)}</div> : <div className="compact-empty"><EmptyState title="No open jobs" message="Closed work remains in the ledger below." /></div>}</Card><Card><div className="card-heading"><div><p className="eyebrow">Entries</p><h2>Ledger history</h2></div></div><LedgerPager karigarId={id} initial={ledger} /></Card></div></AppShell>;
}
