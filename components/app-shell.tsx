import { signOut } from "../auth";
import Link from "next/link";
import { NavLinks } from "./nav-links";

export async function AppShell({ session, children }: { session: { user: { name?: string | null; role: "ISSUE_CLERK" | "FINANCE_HEAD" } }; children: React.ReactNode }) {
  const isFinance = session.user.role === "FINANCE_HEAD";
  return <div className="app-frame">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark">K</span><span>Karigar Gold Ledger</span></Link><div className="user-menu"><span className="user-name">{session.user.name}</span><span className="role-label">{isFinance ? "Finance head" : "Issue clerk"}</span><form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}><button className="signout" type="submit">Sign out</button></form></div></header>
    <div className="shell-body">
      <nav className="side-nav" aria-label="Primary navigation">
        <NavLinks isFinance={isFinance} />
      </nav>
      <main className="content">{children}</main>
    </div>
    <nav className="bottom-nav" aria-label="Mobile navigation"><NavLinks isFinance={isFinance} /></nav>
  </div>;
}
