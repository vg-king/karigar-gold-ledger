"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "./ui";

type Stock = {
  date: string;
  vault: { grams: string };
  withKarigars: { grams: string };
  atRefiner: { grams: string };
  writtenOff: { grams: string };
  reconciliationDifference: { grams: string };
  reconciled: boolean;
  warning: string | null;
  karigars: Array<{ karigarId: string; karigarName: string; grams: string }>;
};

const today = () => new Date().toISOString().slice(0, 10);

export function StockView() {
  const [date, setDate] = useState(today);
  const [stock, setStock] = useState<Stock | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  const [movement, setMovement] = useState({ type: "REFINER_SEND", weight: "", note: "" });
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const maxDate = useMemo(() => today(), []);
  async function load(selectedDate = date) {
    try {
      const response = await fetch(`/api/stock?date=${selectedDate}`);
      if (!response.ok) throw new Error("Unable to load stock");
      setStock(await response.json() as Stock);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stock?date=${date}`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load stock");
      return response.json() as Promise<Stock>;
    }).then((data) => { if (!cancelled) setStock(data); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [date]);
  async function record(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...movement, date, idempotencyKey }),
      });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        setMessage(result.error?.message ?? "Unable to record movement.");
        return;
      }
      setMovement({ ...movement, weight: "", note: "" });
      setIdempotencyKey(crypto.randomUUID());
      setMessage("Refiner movement recorded successfully.");
      await load();
    } catch {
      setMessage("Network error. Retry to safely submit the same movement.");
    } finally {
      setPending(false);
    }
  }
  if (error && !stock) return <ErrorState message="Stock could not be loaded. Refresh to try again." />;
  if (!stock) return <Card><Skeleton /><Skeleton /></Card>;
  const cards = [["Vault", stock.vault.grams], ["With karigars", stock.withKarigars.grams], ["At refiner", stock.atRefiner.grams], ["Written off", stock.writtenOff.grams]];
  return <div className="stock-stack"><div className="stock-toolbar"><label>Date<input className="input" type="date" max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} /></label><a className="button button-quiet" href={`/api/stock/export?date=${date}`}>Export CSV</a></div><div className="metric-grid stock-metrics">{cards.map(([label, value]) => <Card key={label}><p className="metric-label">{label}</p><p className="metric-value gold-number">{value}<span> g</span></p></Card>)}</div><Card><div className="card-heading"><h2>Reconciliation</h2><Badge tone={stock.reconciled ? "accent" : "danger"}>{stock.reconciled ? "Reconciled" : "Mismatch"}</Badge></div><p className={stock.warning ? "inline-error" : "muted"}>{stock.warning ?? "Vault, karigar, refiner, and written-off balances reconcile to opening stock."}</p>{!stock.reconciled && <p className="inline-error">Difference: {stock.reconciliationDifference.grams} g</p>}</Card><Card><div className="card-heading"><h2>Fine gold with karigars</h2></div>{stock.karigars.length ? <div className="stock-karigars">{stock.karigars.map((item) => <div className="stock-karigar-row" key={item.karigarId}><span>{item.karigarName}</span><strong className="gold-number">{item.grams} g</strong></div>)}<div className="stock-karigar-row stock-total"><strong>Total</strong><strong className="gold-number">{stock.withKarigars.grams} g</strong></div></div> : <EmptyState title="No open karigar balances" message="There is no fine gold with karigars on this date." />}</Card><Card><div className="card-heading"><h2>Record refiner movement</h2></div><form onSubmit={record} className="movement-form"><label>Movement<select className="input" value={movement.type} onChange={(event) => setMovement({ ...movement, type: event.target.value })}><option value="REFINER_SEND">Send to refiner</option><option value="REFINER_RETURN">Return from refiner</option></select></label><label>Fine weight (g)<input className="input" required inputMode="decimal" value={movement.weight} onChange={(event) => setMovement({ ...movement, weight: event.target.value })} /></label><label>Note<input className="input" required value={movement.note} onChange={(event) => setMovement({ ...movement, note: event.target.value })} /></label><Button type="submit" disabled={pending}>{pending ? "Recording…" : "Record movement"}</Button></form>{message && <p className={message.includes("successfully") ? "success-message" : "inline-error"} role="status">{message}</p>}</Card></div>;
}
