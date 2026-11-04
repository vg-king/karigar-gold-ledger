import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { Card, PageHeader } from "../../components/ui";

export default async function FinancePage() {
  const session = await requireRole(["FINANCE_HEAD"]);
  if (session instanceof Response) {
    return null;
  }

  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow="Finance" title="Finance workspace" description="Loss alerts and daily stock statements will appear here in the next step." /><Card><p className="muted">This read-only foundation is ready for the finance workflows.</p></Card></div></AppShell>;
}
