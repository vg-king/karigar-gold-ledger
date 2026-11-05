import { requireRole } from "../lib/require-role";
import { prisma } from "../lib/prisma";
import { getBalances } from "../lib/ledger-service";
import { serializeWeight } from "../lib/api";
import { AppShell } from "../components/app-shell";
import { Card, EmptyState, PageHeader } from "../components/ui";
import Link from "next/link";
import { pluralizeCount } from "../lib/counts";
import { getStockStatement } from "../lib/stock-service";

export const dynamic = "force-dynamic";

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
  const reviewCount = session.user.role === "FINANCE_HEAD" ? await prisma.alert.count({ where: { status: "OPEN", kind: "LOSS_REVIEW" } }) : 0;
  const stock = session.user.role === "FINANCE_HEAD" ? await getStockStatement(prisma) : null;
  const totalToday = todayEntries.reduce((sum, entry) => sum + entry.fineMg, 0n);
  const top = [...balances].sort((a, b) => BigInt(b.balance.mg) > BigInt(a.balance.mg) ? 1 : -1).slice(0, 3);
  const todayWeight = serializeWeight(totalToday);
  return <AppShell session={session}><div className="page-shell">
    <PageHeader eyebrow="Overview" title={`Welcome back, ${session.user.name ?? "there"}`} description="A clear view of today's gold position." />
    <div className="metric-grid"><Card><p className="metric-label">Fine gold issued today</p><p className="metric-value gold-number">{todayWeight.grams}<span> g</span></p></Card><Card><p className="metric-label">Open jobs</p><p className="metric-value gold-number">{openJobs}</p><small className="metric-caption">{pluralizeCount(openJobs, "open job")}</small></Card><Card><p className="metric-label">Active karigars</p><p className="metric-value gold-number">{balances.length}</p><small className="metric-caption">{pluralizeCount(balances.length, "karigar")}</small></Card></div>
    {session.user.role === "FINANCE_HEAD" && <><Card><div className="card-heading"><div><p className="eyebrow">Stock</p><h2>Gold in vault</h2></div><Link href="/stock" className="text-link">View statement</Link></div><p className="hero-number gold-number">{stock?.vault.grams}<span> g</span></p></Card><Card><div className="card-heading"><div><p className="eyebrow">Attention</p><h2>Review items</h2></div><Link href="/finance" className="text-link">{reviewCount} open · Review</Link></div></Card></>}<Card><div className="card-heading"><div><p className="eyebrow">Attention</p><h2>Highest outstanding balances</h2></div><Link href="/balances" className="text-link">View all</Link></div>{top.length ? <div className="rank-list">{top.map((item, index) => <Link className="rank-row" href={`/karigars/${item.id}`} key={item.id}><span className="rank">{String(index + 1).padStart(2, "0")}</span><span><strong>{item.name}</strong><small>{item.code} · {pluralizeCount(item.openJobs, "open job")}</small></span><strong className="gold-number">{item.balance.grams} g</strong></Link>)}</div> : <EmptyState title="No balances yet" message="Once ledger entries arrive, the highest balances will appear here." />}</Card>
  </div></AppShell>;
}
