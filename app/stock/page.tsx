import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/ui";
import { StockView } from "../../components/stock-view";

export default async function StockPage() {
  const session = await requireRole(["FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow="Stock" title="Daily stock statement" description="Fine gold position at the end of a chosen date." /><StockView /></div></AppShell>;
}
