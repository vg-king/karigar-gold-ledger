import { signOut } from "../auth";
import { requireRole } from "../lib/require-role";

export default async function HomePage() {
  const session = await requireRole(["ISSUE_CLERK", "FINANCE_HEAD"]);
  if (session instanceof Response) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Karigar Gold Ledger</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Welcome, {session.user.name}</h1>
        <p className="mt-2 text-slate-600">Signed in as <strong>{session.user.role}</strong>.</p>
        <form action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }} className="mt-7">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white">Sign out</button>
        </form>
      </section>
    </main>
  );
}

