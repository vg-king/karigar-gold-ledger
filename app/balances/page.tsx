import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { BalancesView } from "../../components/balances-view";

export default async function BalancesPage() {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  return <AppShell session={session}><BalancesView /></AppShell>;
}
