import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">403</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Access denied</h1>
        <p className="mt-2 text-slate-600">You do not have permission to view this page.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white">
          Back to home
        </Link>
      </section>
    </main>
  );
}
