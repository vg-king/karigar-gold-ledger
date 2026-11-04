import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="auth-page">
      <section className="auth-card surface forbidden-card">
        <p className="eyebrow">403</p>
        <h1>Access denied</h1>
        <p className="muted">You do not have permission to view this page.</p>
        <Link href="/" className="button button-primary">
          Back to home
        </Link>
      </section>
    </main>
  );
}
