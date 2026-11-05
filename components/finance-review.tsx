"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "./ui";

type ReviewItem = {
  id: string; status: "OPEN" | "REVIEWED"; detail: string; karigar: { name: string }; job: { jobNo: string };
  latestLossPercent: string; meanPercent: string; standardDeviationPercent: string; zScore: number; jobsCompared: number;
  allowedWastage: { grams: string }; actualLoss: { grams: string };
  series: Array<{ jobNo: string; lossPercent: string }>;
};

export function FinanceReview() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/alerts").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load review items");
      return response.json() as Promise<{ alerts: ReviewItem[] }>;
    }).then((data) => setItems(data.alerts)).catch(() => setError(true));
  }, []);
  async function review(alertId: string) {
    const reviewNote = window.prompt("Optional review note") ?? undefined;
    const response = await fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alertId, reviewNote }) });
    if (!response.ok) throw new Error("Unable to mark item as reviewed");
    setItems((await response.json() as { alerts: ReviewItem[] }).alerts);
  }
  if (error) return <ErrorState message="Review items could not be loaded. Refresh to try again." />;
  if (!items) return <Card><Skeleton /><Skeleton /></Card>;
  if (!items.length) return <Card><EmptyState title="No review items" message="There are no loss drift items to review." /></Card>;
  return <div className="review-list">{items.map((item) => <Card key={item.id} className="review-card"><div className="card-heading"><div><p className="eyebrow">{item.karigar.name} · {item.job.jobNo}</p><h2>{item.detail}</h2></div><Badge tone={item.status === "OPEN" ? "danger" : "accent"}>{item.status === "OPEN" ? "Needs review" : "Reviewed"}</Badge></div><div className="review-metrics"><span>Latest loss <strong>{item.latestLossPercent}%</strong></span><span>Own average <strong>{item.meanPercent}%</strong></span><span>Std. deviation <strong>{item.standardDeviationPercent}%</strong></span><span>Z-score <strong>{item.zScore.toFixed(2)}</strong></span><span>Jobs compared <strong>{item.jobsCompared}</strong></span><span>Allowed wastage <strong>{item.allowedWastage.grams} g</strong></span><span>Actual loss <strong>{item.actualLoss.grams} g</strong></span></div><div className="sparkline" aria-label="Closed-job loss percentage series">{item.series.map((point) => <span key={point.jobNo} title={`${point.jobNo}: ${point.lossPercent}%`} style={{ height: `${Math.max(8, Math.min(100, Number(point.lossPercent) * 20))}%` }} />)}</div>{item.status === "OPEN" && <Button variant="quiet" onClick={() => { void review(item.id).catch(() => setError(true)); }}>Mark as reviewed</Button>}</Card>)}</div>;
}
