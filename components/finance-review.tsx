"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "./ui";
import { useBodyScrollLock } from "./use-body-scroll-lock";

type ReviewItem = {
  id: string; status: "OPEN" | "REVIEWED"; detail: string; karigar: { name: string }; job: { jobNo: string };
  latestLossPercent: string; meanPercent: string; standardDeviationPercent: string; zScore: number; jobsCompared: number;
  allowedWastage: { grams: string }; actualLoss: { grams: string };
  series: Array<{ jobNo: string; lossPercent: string }>;
};

export function FinanceReview() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState(false);
  const [reviewing, setReviewing] = useState<ReviewItem | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewError, setReviewError] = useState("");
  useBodyScrollLock(Boolean(reviewing));
  useEffect(() => {
    fetch("/api/alerts").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load review items");
      return response.json() as Promise<{ alerts: ReviewItem[] }>;
    }).then((data) => setItems(data.alerts)).catch(() => setError(true));
  }, []);
  async function review() {
    if (!reviewing) return;
    setReviewPending(true);
    setReviewError("");
    try {
      const response = await fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alertId: reviewing.id, reviewNote: reviewNote || undefined }) });
      if (!response.ok) throw new Error("Unable to mark item as reviewed");
      setItems((await response.json() as { alerts: ReviewItem[] }).alerts);
      setReviewing(null);
      setReviewNote("");
    } catch (requestError) {
      setReviewError(requestError instanceof Error ? requestError.message : "Unable to mark item as reviewed");
    } finally {
      setReviewPending(false);
    }
  }
  if (error) return <ErrorState message="Review items could not be loaded. Refresh to try again." />;
  if (!items) return <Card><Skeleton /><Skeleton /></Card>;
  if (!items.length) return <Card><EmptyState title="No review items" message="There are no loss drift items to review." /></Card>;
  return <div className="review-list">{items.map((item) => <Card key={item.id} className="review-card"><div className="card-heading"><div><p className="eyebrow">{item.karigar.name} · {item.job.jobNo}</p><h2>{item.detail}</h2></div><Badge tone={item.status === "OPEN" ? "danger" : "accent"}>{item.status === "OPEN" ? "Needs review" : "Reviewed"}</Badge></div><div className="review-metrics"><span>Latest loss <strong>{item.latestLossPercent}%</strong></span><span>Own average <strong>{item.meanPercent}%</strong></span><span>Std. deviation <strong>{item.standardDeviationPercent}%</strong></span><span>Z-score <strong>{item.zScore.toFixed(2)}</strong></span><span>Jobs compared <strong>{item.jobsCompared}</strong></span><span>Allowed wastage <strong>{item.allowedWastage.grams} g</strong></span><span>Actual loss <strong>{item.actualLoss.grams} g</strong></span></div><div className="sparkline" aria-label="Closed-job loss percentage series">{item.series.map((point) => <span key={point.jobNo} title={`${point.jobNo}: ${point.lossPercent}%`} style={{ height: `${Math.max(8, Math.min(100, Number(point.lossPercent) * 20))}%` }} />)}</div>{item.status === "OPEN" && <Button variant="quiet" onClick={() => { setReviewing(item); setReviewNote(""); setReviewError(""); }}>Mark as reviewed</Button>}</Card>)}{reviewing && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Review note"><form className="surface modal" onSubmit={(event) => { event.preventDefault(); void review(); }}><p className="eyebrow">Review item</p><h2>Mark as reviewed</h2><label>Optional review note<textarea className="input" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} /></label>{reviewError && <p className="inline-error" role="alert">{reviewError}</p>}<div className="modal-actions"><Button variant="quiet" onClick={() => setReviewing(null)} disabled={reviewPending}>Cancel</Button><Button type="submit" disabled={reviewPending}>{reviewPending ? "Saving…" : "Save review"}</Button></div></form></div>}</div>;
}
