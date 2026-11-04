import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { Card, PageHeader } from "../../components/ui";
export default async function ReceiptPage() {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow="Entry" title="Receive gold" description="The receipt form will be added in the next step." /><Card><p className="muted">Read screens are ready. No receipt can be created from this placeholder.</p></Card></div></AppShell>;
}
