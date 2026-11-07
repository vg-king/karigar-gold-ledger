"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "./ui";
import { pluralizeCount } from "../lib/counts";
import { fetchReadWithRetry } from "../lib/read-request";
import { SlowLoadingMessage } from "./slow-loading-message";

type Balance = { id: string; name: string; code: string; balance: { mg: string; grams: string }; openJobs: number };

export function BalancesView() {
  const [items, setItems] = useState<Balance[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => { fetchReadWithRetry("/api/balances").then(async (response) => { if (!response.ok) throw new Error(); return response.json(); }).then(setItems).catch(() => setError(true)); }, []);
  const filtered = useMemo(() => (items ?? []).filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => BigInt(a.balance.mg) > BigInt(b.balance.mg) ? -1 : 1), [items, query]);
  return <div className="page-shell"><PageHeader eyebrow="Ledger" title="Balances" description="Outstanding fine gold by karigar." /><Card><label className="search-label" htmlFor="balance-search">Search karigars</label><input id="balance-search" className="input" placeholder="Name or code" value={query} onChange={(event) => setQuery(event.target.value)} />{error ? <ErrorState message="Try refreshing the page." /> : items === null ? <div className="loading-stack"><Skeleton /><Skeleton /><Skeleton /><SlowLoadingMessage /></div> : filtered.length === 0 ? <EmptyState title={query ? "No matches" : "No balances yet"} message={query ? "Try a different name or code." : "There are no karigar balances to show."} /> : <div className="balance-list">{filtered.map((item) => <Link className="balance-row" href={`/karigars/${item.id}`} key={item.id}><span><strong>{item.name}</strong><small>{item.code}</small></span><span className="row-meta"><Badge>{pluralizeCount(item.openJobs, "open job")}</Badge><strong className="gold-number balance-number">{item.balance.grams} g</strong></span></Link>)}</div>}</Card></div>;
}
