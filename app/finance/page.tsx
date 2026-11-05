import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { Card, PageHeader } from "../../components/ui";

export default async function FinancePage() {
  const session = await requireRole(["FINANCE_HEAD"]);
  if (session instanceof Response) {
    return null;
  }

  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow="Finance" title="Finance workspace" description="Review gold movement and operational information in one place." /><Card><p className="muted">Finance tools are available here for authorized review.</p></Card></div></AppShell>;
}
