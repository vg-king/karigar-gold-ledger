import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/ui";
import { IssueForm } from "../../components/issue-form";
export default async function IssuePage() {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  return <AppShell session={session}><div className="page-shell"><PageHeader eyebrow="Entry" title="Issue gold" description="Record gold handed to a karigar with exact fine-weight calculations." /><IssueForm /></div></AppShell>;
}
