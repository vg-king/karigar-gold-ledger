"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });
    if (!result || result.error) {
      setError(result?.code === "RATE_LIMITED"
        ? "Too many attempts. Try again in 15 minutes."
        : "Invalid email or password.");
      setLoading(false);
      return;
    }
    window.location.assign(result.url ?? "/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Karigar Gold Ledger</p>
        <h1 className="mb-7 text-2xl font-semibold text-slate-900">Sign in</h1>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600" />
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-sky-600" />
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-sky-700 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
