import { requireRole } from "../../lib/require-role";

export default async function FinancePage() {
  const session = await requireRole(["FINANCE_HEAD"]);
  if (session instanceof Response) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Finance area</h1>
        <p className="mt-2 text-slate-600">Signed in as {session.user.name}.</p>
      </section>
    </main>
  );
}

