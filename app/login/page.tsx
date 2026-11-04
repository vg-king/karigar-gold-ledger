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
    <main className="auth-page">
      <form onSubmit={submit} className="auth-card surface">
        <p className="eyebrow">Karigar Gold Ledger</p>
        <h1>Sign in</h1>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="input" />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="input" />
        {error && <p role="alert" className="inline-error">{error}</p>}
        <button type="submit" disabled={loading} className="button button-primary auth-submit">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
