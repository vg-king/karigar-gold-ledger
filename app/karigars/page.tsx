import { requireRole } from "../../lib/require-role";
import { AppShell } from "../../components/app-shell";
import { KarigarMaster } from "../../components/karigar-master";

export default async function KarigarsPage() {
  const session = await requireRole(["FINANCE_HEAD"]);
  if (session instanceof Response) return null;
  return <AppShell session={session}><KarigarMaster /></AppShell>;
}
