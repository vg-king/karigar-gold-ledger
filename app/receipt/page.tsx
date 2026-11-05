import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/ui";
import { ReceiptForm } from "../../components/receipt-form";
export default async function ReceiptPage() {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow="Entry" title="Receive gold" description="Record piece, scrap or filings returned against an open job." /><ReceiptForm /></div></AppShell>;
}
