"use client";

import { FormEvent, useEffect, useState } from "react";
import { calculateFineWeight, getSubmissionKey } from "../lib/entry-form";
import { formatGoldForDisplay } from "../lib/format-gold";
import { parseWeightToMg } from "../lib/gold";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "./ui";
import { Field } from "./field";
import { ScaleReader, type AiEvidence } from "./scale-reader";
import { scaleValuesDiffer } from "../lib/scale-reader";
import { useBodyScrollLock } from "./use-body-scroll-lock";

type Job = { id: string; jobNo: string; karigar: { name: string; code: string }; category: { name: string }; outstanding: { grams: string }; issuedFine: { grams: string }; receivedFine: { grams: string }; actualLoss: { grams: string }; allowedWastage: { grams: string }; lossBeyondAllowance: { grams: string } };
type FormErrors = Record<string, string>;

export function ReceiptForm() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobId, setJobId] = useState("");
  const [type, setType] = useState("RECEIPT_PIECE");
  const [grossWeight, setGrossWeight] = useState("");
  const [purity, setPurity] = useState("91.60");
  const [netWeight, setNetWeight] = useState("");
  const [huid, setHuid] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [jobsError, setJobsError] = useState(false);
  const [closeSummary, setCloseSummary] = useState<Record<string, { grams: string }> | null>(null);
  const [created, setCreated] = useState<{ id: string; fine: { grams: string } } | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closePending, setClosePending] = useState(false);
  useBodyScrollLock(closeOpen);
  const [aiEvidence, setAiEvidence] = useState<AiEvidence>({ aiResolution: "NONE" });
  const [aiReading, setAiReading] = useState<{ weight: { mg: string } | null; purity: { bp: number } | null } | null>(null);
  const selected = jobs?.find((job) => job.id === jobId);
  function updateAiEvidence(evidence: AiEvidence) {
    setAiEvidence(evidence);
    setAiReading(evidence.aiReadingMg || evidence.aiReadingPurityBp !== undefined ? { weight: evidence.aiReadingMg ? { mg: evidence.aiReadingMg } : null, purity: evidence.aiReadingPurityBp === undefined ? null : { bp: evidence.aiReadingPurityBp } } : null);
  }

  async function loadJobs() {
    setJobs(null);
    setJobsError(false);
    try { const response = await fetch("/api/jobs"); if (!response.ok) throw new Error(); const result = await response.json(); setJobs(result); } catch { setJobsError(true); setMessage(""); }
  }
  useEffect(() => {
    void fetch("/api/jobs").then(async (response) => {
      if (!response.ok) throw new Error();
      const result = await response.json();
      setJobs(result);
    }).catch(() => setJobsError(true));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (type === "RECEIPT_PIECE" && netWeight && grossWeight) {
      try {
        if (parseWeightToMg(netWeight) > parseWeightToMg(grossWeight)) {
          setErrors({ netWeight: "Net weight cannot exceed gross weight." });
          requestAnimationFrame(() => (document.querySelector('[name="netWeight"]') as HTMLElement | null)?.focus());
          return;
        }
      } catch {
        // The server provides the authoritative decimal validation.
      }
    }
    setPending(true); setErrors({}); setMessage("");
    const submissionKey = getSubmissionKey(key); setKey(submissionKey);
    const response = await fetch("/api/receipts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId, type, grossWeight, purity, netWeight: netWeight || undefined, huid: huid || undefined, idempotencyKey: submissionKey, ...aiEvidence }) }).catch(() => null);
    if (!response) { setMessage("Network error. Retry to safely submit the same receipt."); setPending(false); return; }
    const result = await response.json();
    if (!response.ok) { const field = result.error?.field; setErrors(field ? { [field]: result.error.message } : {}); setMessage(field ? "" : result.error?.code === "NEGATIVE_BALANCE" ? "This receipt is larger than the outstanding balance." : result.error?.code === "JOB_CLOSED" ? "This job is closed and cannot accept receipts." : result.error?.message ?? "Could not create the receipt."); setPending(false);     requestAnimationFrame(() => (document.querySelector(`[name="${field ?? "grossWeight"}"]`) as HTMLElement | null)?.focus()); return; }
    setCreated(result.entry); setKey(null); setPending(false); setGrossWeight(""); setNetWeight(""); setHuid(""); setType("RECEIPT_PIECE"); setAiEvidence({ aiResolution: "NONE" }); setAiReading(null); await loadJobs();
  }

  async function closeJob() {
    if (!selected || closePending) return;
    setClosePending(true);
    const closedJobId = selected.id;
    const response = await fetch(`/api/jobs/${closedJobId}/close`, { method: "POST" });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error?.message ?? "Could not close the job."); setClosePending(false); return; }
    setCloseSummary(result);
    setCloseOpen(false);
    setJobId("");
    setGrossWeight("");
    setNetWeight("");
    setHuid("");
    setErrors({});
    setMessage("");
    await loadJobs();
    setClosePending(false);
  }

  const fine = calculateFineWeight(grossWeight, purity);
  if (!jobs && !message) return <Card><Skeleton /><Skeleton /></Card>;
  if (jobs && !jobs.length) return <Card><EmptyState title="No open jobs" message="Create an issue before recording a receipt." /></Card>;
  if (!jobs) return jobsError
    ? <Card><div className="state-box"><h3>Balance unavailable</h3><p>Open jobs and their balances could not be loaded.</p><button type="button" className="retry-link" onClick={() => void loadJobs()}>Retry</button></div></Card>
    : <ErrorState message={message} />;
  return <div className="entry-grid">
    <Card><div className="card-heading"><div><p className="eyebrow">New receipt</p><h2>Record gold received</h2></div><Badge tone="accent">Open jobs only</Badge></div><form onSubmit={submit} noValidate className="entry-form">
      <Field label="Open job" error={errors.jobId}><select name="jobId" className="input" value={jobId} onChange={(event) => setJobId(event.target.value)} required><option value="">Choose open job</option>{jobs.map((job) => <option value={job.id} key={job.id}>{job.jobNo} · {job.karigar.name}</option>)}</select></Field>
      <Field label="Receipt type"><select name="type" className="input" value={type} onChange={(event) => setType(event.target.value)}><option value="RECEIPT_PIECE">Piece</option><option value="RECEIPT_SCRAP">Scrap</option><option value="RECEIPT_FILINGS">Filings</option></select></Field>
      <Field label="Gross weight (g)" error={errors.grossWeight}><input name="grossWeight" className="input" inputMode="decimal" value={grossWeight} onChange={(event) => setGrossWeight(event.target.value)} required /> </Field>
      <Field label="Purity (%)" error={errors.purity}><input name="purity" className="input" inputMode="decimal" value={purity} onChange={(event) => setPurity(event.target.value)} required /></Field>
      <ScaleReader weight={grossWeight} purity={purity} onWeight={setGrossWeight} onPurity={setPurity} onEvidence={updateAiEvidence} />
      {type === "RECEIPT_PIECE" && <><Field label="Net weight (g)" error={errors.netWeight}><input name="netWeight" className="input" inputMode="decimal" value={netWeight} onChange={(event) => setNetWeight(event.target.value)} required /></Field><Field label="HUID" error={errors.huid}><input name="huid" className="input" value={huid} onChange={(event) => setHuid(event.target.value)} required /></Field></>}
      <div className="live-fine"><span className="live-fine-label">Fine weight</span><strong className="gold-number">{fine ? formatGoldForDisplay(fine) : "—"} <span>g</span></strong><small>Calculated live; the server recalculates before saving.</small></div>
      {selected && <div className="mobile-summary"><p className="eyebrow">Live summary</p><strong>{selected.jobNo} · {selected.karigar.name}</strong><span className="gold-number">{selected.outstanding.grams} g outstanding</span></div>}
      {message && <p className="inline-error" role="alert">{message}</p>}<Button type="submit" disabled={pending || (aiEvidence.aiResolution === "NONE" && Boolean(aiEvidence.aiReadingMg || aiEvidence.aiReadingPurityBp) && aiReading !== null && scaleValuesDiffer(aiReading, grossWeight, purity))}>{pending ? "Saving…" : "Create receipt"}</Button>
    </form></Card>
    {selected && <Card className="side-summary"><p className="eyebrow">Live summary</p><h2>{selected.jobNo} · {selected.karigar.name}</h2><p className="muted">{selected.category.name} · {selected.karigar.code}</p><div className="review-panel"><div><span>Issued fine</span><strong className="gold-number">{selected.issuedFine.grams} g</strong></div><div><span>Received so far</span><strong className="gold-number">{selected.receivedFine.grams} g</strong></div><div><span>Outstanding</span><strong className="gold-number">{selected.outstanding.grams} g</strong></div><div><span>Allowed wastage</span><strong className="gold-number">{selected.allowedWastage.grams} g</strong></div></div><Button variant="quiet" onClick={() => setCloseOpen(true)}>Review and close job</Button></Card>}
    {created && <Card className="success-panel"><p className="eyebrow">Receipt created</p><h2>{created.fine.grams} g fine recorded</h2><p className="muted">Entry reference {created.id} · New balance will appear after refresh.</p><Button variant="quiet" onClick={() => setCreated(null)}>Record another</Button></Card>}
    {closeSummary && <Card className="success-panel"><p className="eyebrow">Job closed</p><h2>Review complete</h2><div className="review-panel"><div><span>Issued</span><strong>{closeSummary.issuedFine.grams} g</strong></div><div><span>Received</span><strong>{closeSummary.receivedFine.grams} g</strong></div><div><span>Allowed wastage</span><strong>{closeSummary.allowedWastage.grams} g</strong></div><div><span>Actual loss</span><strong>{closeSummary.actualLoss.grams} g</strong></div><div><span>Beyond allowance</span><strong>{closeSummary.lossBeyondAllowance.grams} g</strong></div></div></Card>}
    {closeOpen && selected && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Confirm close ${selected.jobNo}`}><div className="surface modal"><p className="eyebrow">Confirm close</p><h2>Review {selected.jobNo}</h2><p className="muted">Closing is permanent. This neutral review summary will be saved with the job.</p><div className="review-panel"><div><span>Issued</span><strong>{selected.issuedFine.grams} g</strong></div><div><span>Received</span><strong>{selected.receivedFine.grams} g</strong></div><div><span>Allowed wastage</span><strong>{selected.allowedWastage.grams} g</strong></div><div><span>Outstanding</span><strong>{selected.outstanding.grams} g</strong></div></div><div className="modal-actions"><Button variant="quiet" onClick={() => setCloseOpen(false)} disabled={closePending}>Cancel</Button><Button onClick={closeJob} disabled={closePending}>{closePending ? "Closing…" : "Confirm close"}</Button></div></div></div>}
  </div>;
}
