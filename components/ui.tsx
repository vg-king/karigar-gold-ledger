import Link from "next/link";

export function Button({ children, href, type = "button", variant = "primary", disabled = false, onClick }: {
  children: React.ReactNode; href?: string; type?: "button" | "submit"; variant?: "primary" | "quiet"; disabled?: boolean; onClick?: () => void;
}) {
  const className = `button button-${variant}`;
  return href ? <Link className={className} href={href}>{children}</Link> : <button className={className} type={type} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`surface card ${className}`}>{children}</section>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "danger" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="state-box"><h3>{title}</h3><p>{message}</p></div>;
}

export function ErrorState({ message = "We could not load this view." }: { message?: string }) {
  return <div className="state-box state-error"><h3>Something went wrong</h3><p>{message}</p></div>;
}

export function Skeleton({ className = "skeleton-line" }: { className?: string }) {
  return <div aria-label="Loading" className={`skeleton ${className}`} />;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</header>;
}
