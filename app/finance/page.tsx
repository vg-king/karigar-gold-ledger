import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/ui";
import { FinanceReview } from "../../components/finance-review";

export default async function FinancePage() {
  const session = await requireRole(["FINANCE_HEAD"]);
  if (session instanceof Response) {
    return null;
  }

  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow="Finance" title="Loss review items" description="Review recent loss rates against each karigar's own closed-job history." /><FinanceReview /></div></AppShell>;
}
