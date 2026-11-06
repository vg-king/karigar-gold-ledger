"use client";

import { useState } from "react";
import { EmptyState, ErrorState, Table } from "./ui";
import { formatBasisPoints } from "../lib/format-gold";

type Entry = { id: string; type: string; gross: { grams: string }; fine: { grams: string }; purityBp: number; createdAt: string; aiResolution?: string };
type Result = { entries: Entry[]; page: number; pageSize: number; total: number };
export function LedgerPager({ karigarId, initial }: { karigarId: string; initial: Result }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState(false);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  async function move(page: number) {
    setError(false);
    try { const response = await fetch(`/api/karigars/${karigarId}/ledger?page=${page}&pageSize=25`); if (!response.ok) throw new Error(); setData(await response.json()); } catch { setError(true); }
  }
  if (error) return <ErrorState message="The ledger page could not be loaded." />;
  if (!data.entries.length) return <EmptyState title="No ledger entries" message="Entries will appear here as work is issued and received." />;
  return <><Table><table><thead><tr><th>Date</th><th>Type</th><th>Gross</th><th>Purity</th><th>Fine</th></tr></thead><tbody>{data.entries.map((entry) => <tr key={entry.id}><td data-label="Date">{new Date(entry.createdAt).toLocaleDateString()}</td><td data-label="Type">{entry.type.replaceAll("_", " ")} {entry.aiResolution === "USED_AI" && <span className="ai-marker">AI-assisted</span>}</td><td data-label="Gross" className="gold-number">{entry.gross.grams} g</td><td data-label="Purity" className="gold-number">{formatBasisPoints(entry.purityBp)}%</td><td data-label="Fine" className="gold-number"><strong>{entry.fine.grams} g</strong></td></tr>)}</tbody></table></Table><div className="pager"><button className="button button-quiet" disabled={data.page <= 1} onClick={() => move(data.page - 1)}>Previous</button><span>Page {data.page} of {pages}</span><button className="button button-quiet" disabled={data.page >= pages} onClick={() => move(data.page + 1)}>Next</button></div></>;
}
