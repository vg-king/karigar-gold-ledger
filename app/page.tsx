import { requireRole } from "../lib/require-role";
import { prisma } from "../lib/prisma";
import { getBalances } from "../lib/ledger-service";
import { serializeWeight } from "../lib/api";
import { AppShell } from "../components/app-shell";
import { Card, EmptyState, PageHeader } from "../components/ui";
import Link from "next/link";

export default async function HomePage() {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) {
    return null;
  }
  const [balances, openJobs, todayEntries] = await Promise.all([
    getBalances(prisma),
    prisma.job.count({ where: { status: "OPEN" } }),
    prisma.ledgerEntry.findMany({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, type: "ISSUE" }, select: { fineMg: true } }),
  ]);
  const totalToday = todayEntries.reduce((sum, entry) => sum + entry.fineMg, 0n);
  const top = [...balances].sort((a, b) => BigInt(b.balance.mg) > BigInt(a.balance.mg) ? 1 : -1).slice(0, 3);
  const todayWeight = serializeWeight(totalToday);
  return <AppShell session={session}><div className="page-shell">
    <PageHeader eyebrow="Overview" title={`Good morning, ${session.user.name ?? "there"}`} description="A clear view of today's gold position." />
    <div className="metric-grid"><Card><p className="metric-label">Fine gold issued today</p><p className="metric-value gold-number">{todayWeight.grams}<span> g</span></p></Card><Card><p className="metric-label">Open jobs</p><p className="metric-value">{openJobs}</p></Card><Card><p className="metric-label">Active karigars</p><p className="metric-value">{balances.length}</p></Card></div>
    <Card><div className="card-heading"><div><p className="eyebrow">Attention</p><h2>Highest outstanding balances</h2></div><Link href="/balances" className="text-link">View all</Link></div>{top.length ? <div className="rank-list">{top.map((item, index) => <Link className="rank-row" href={`/karigars/${item.id}`} key={item.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span><strong>{item.name}</strong><small>{item.code} · {item.openJobs} open jobs</small></span><strong className="gold-number">{item.balance.grams} g</strong></Link>)}</div> : <EmptyState title="No balances yet" message="Once ledger entries arrive, the highest balances will appear here." />}</Card>
  </div></AppShell>;
}
