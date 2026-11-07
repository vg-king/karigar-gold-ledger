"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { pluralizeCount } from "../lib/counts";
import { calculateFineWeight, getSubmissionKey } from "../lib/entry-form";
import { formatGoldForDisplay } from "../lib/format-gold";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "./ui";
import { Field } from "./field";
import { ScaleReader, type AiEvidence } from "./scale-reader";
import { scaleValuesDiffer } from "../lib/scale-reader";
import { sanitizeDecimalInput } from "../lib/decimal-input";

type Karigar = { id: string; name: string; code: string };
type Category = { id: string; name: string };
type Balance = { balance: { grams: string }; openJobs: Array<unknown> };
type FormErrors = Record<string, string>;

export function IssueForm() {
  const [karigars, setKarigars] = useState<Karigar[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selectedKarigar, setSelectedKarigar] = useState("");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [grossWeight, setGrossWeight] = useState("");
  const [purity, setPurity] = useState("91.60");
  const [huid, setHuid] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [created, setCreated] = useState<{ id: string; fine: { grams: string }; gross: { grams: string }; purityBp: number; jobId: string } | null>(null);
  const [aiEvidence, setAiEvidence] = useState<AiEvidence>({ aiResolution: "NONE" });
  const [aiReading, setAiReading] = useState<{ weight: { mg: string } | null; purity: { bp: number } | null } | null>(null);
  function updateAiEvidence(evidence: AiEvidence) {
    setAiEvidence(evidence);
    setAiReading(evidence.aiReadingMg || evidence.aiReadingPurityBp !== undefined ? { weight: evidence.aiReadingMg ? { mg: evidence.aiReadingMg } : null, purity: evidence.aiReadingPurityBp === undefined ? null : { bp: evidence.aiReadingPurityBp } } : null);
  }

  useEffect(() => {
    Promise.all([fetch("/api/karigars"), fetch("/api/categories")]).then(async ([karigarResponse, categoryResponse]) => {
      if (!karigarResponse.ok || !categoryResponse.ok) throw new Error();
      const nextKarigars = await karigarResponse.json();
      setKarigars(nextKarigars);
      setCategories(await categoryResponse.json());
    }).catch(() => setMessage("Could not load the entry options. Try again."));
  }, []);

  async function loadBalance(karigarId: string) {
    setBalance(null);
    setBalanceError(false);
    try {
      const response = await fetch(`/api/karigars/${karigarId}/balance`);
      if (!response.ok) throw new Error();
      setBalance(await response.json());
    } catch {
      setBalanceError(true);
    }
  }

  useEffect(() => {
    if (!selectedKarigar) return;
    void fetch(`/api/karigars/${selectedKarigar}/balance`).then(async (response) => {
      if (!response.ok) throw new Error();
      setBalance(await response.json());
      setBalanceError(false);
    }).catch(() => {
      setBalance(null);
      setBalanceError(true);
    });
  }, [selectedKarigar]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage("");
    const key = getSubmissionKey(submissionKey);
    setSubmissionKey(key);
    const response = await fetch("/api/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ karigarId: selectedKarigar, categoryId, grossWeight, purity, huid: huid || undefined, idempotencyKey: key, ...aiEvidence }),
    }).catch(() => null);
    if (!response) {
      setMessage("Network error. Retry to safely submit the same entry.");
      setPending(false);
      return;
    }
    const result = await response.json();
    if (!response.ok) {
      const field = result.error?.field;
      setErrors(field ? { [field]: result.error.message } : {});
      setMessage(field ? "" : result.error?.message ?? "Could not create the issue.");
      setPending(false);
      requestAnimationFrame(() => (document.querySelector(`[name="${field ?? "grossWeight"}"]`) as HTMLElement | null)?.focus());
      return;
    }
    setCreated(result.entry);
    setBalance(result.balance ? { balance: result.balance, openJobs: Array.from({ length: result.openJobCount ?? 0 }) } : null);
    setSubmissionKey(null);
    setPending(false);
  }

  const fine = calculateFineWeight(grossWeight, purity);
  const selectedName = karigars?.find((item) => item.id === selectedKarigar)?.name;
  function resetForm() {
    setCreated(null);
    setSelectedKarigar("");
    setCategoryId("");
    setGrossWeight("");
    setPurity("91.60");
    setHuid("");
    setBalance(null);
    setMessage("");
    setErrors({});
    setAiEvidence({ aiResolution: "NONE" });
    setAiReading(null);
  }
  if (message && !karigars && !categories) return <ErrorState message={message} />;
  if (!karigars || !categories) return <Card><Skeleton /><Skeleton /></Card>;
  if (!karigars.length || !categories.length) return <Card><EmptyState title="No entry options" message="Add a karigar and category before creating an issue." /></Card>;
  return <div className="entry-grid">
    <Card><div className="card-heading"><div><p className="eyebrow">New issue</p><h2>Record gold issued</h2></div><Badge tone="accent">Server verified</Badge></div>
      <form onSubmit={submit} noValidate className="entry-form">
        <Field label="Karigar" error={errors.karigarId}><select name="karigarId" className="input" value={selectedKarigar} onChange={(event) => setSelectedKarigar(event.target.value)} required><option value="">Choose karigar</option>{karigars.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.code}</option>)}</select></Field>
        <Field label="Item category" error={errors.categoryId}><select name="categoryId" className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Choose category</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Gross weight (g)" error={errors.grossWeight}><input name="grossWeight" className="input" inputMode="decimal" placeholder="120.000" value={grossWeight} onChange={(event) => setGrossWeight(sanitizeDecimalInput(event.target.value, 3))} required /></Field>
        <Field label="Purity (%)" error={errors.purity}><input name="purity" className="input" inputMode="decimal" value={purity} onChange={(event) => setPurity(sanitizeDecimalInput(event.target.value, 2))} required /></Field>
        <ScaleReader weight={grossWeight} purity={purity} onWeight={setGrossWeight} onPurity={setPurity} onEvidence={updateAiEvidence} />
        <Field label={<>HUID <span className="muted">(optional)</span></>} error={errors.huid}><input name="huid" className="input" value={huid} onChange={(event) => setHuid(event.target.value)} /></Field>
        <div className="live-fine"><span className="live-fine-label">Fine weight</span><strong className="gold-number">{fine ? formatGoldForDisplay(fine) : "—"} <span>g</span></strong><small>Calculated live; the server recalculates before saving.</small></div>
        <div className="mobile-summary"><p className="eyebrow">Live summary</p><strong>{selectedName ?? "Choose a karigar"}</strong>{balance ? <><span className="gold-number">{balance.balance.grams} g</span><span className="muted">{pluralizeCount(balance.openJobs.length, "open job")}</span></> : balanceError ? <span className="unavailable">Balance unavailable · <button type="button" className="retry-link" onClick={() => void loadBalance(selectedKarigar)}>Retry</button></span> : <span className="muted">Loading balance…</span>}</div>
        {message && <p className="inline-error" role="alert">{message}</p>}
        <Button type="submit" disabled={pending || (aiEvidence.aiResolution === "NONE" && Boolean(aiEvidence.aiReadingMg || aiEvidence.aiReadingPurityBp) && aiReading !== null && scaleValuesDiffer(aiReading, grossWeight, purity))}>{pending ? "Saving…" : "Create issue"}</Button>
      </form>
    </Card>
    <Card className="side-summary"><p className="eyebrow">Live summary</p><h2>{selectedName ?? "Choose a karigar"}</h2><p className="metric-label">Current balance</p>{balance ? <><p className="hero-number gold-number">{balance.balance.grams}<span> g</span></p><p className="muted">{pluralizeCount(balance.openJobs.length, "open job")}</p></> : balanceError ? <p className="unavailable">Balance unavailable · <button type="button" className="retry-link" onClick={() => void loadBalance(selectedKarigar)}>Retry</button></p> : <p className="muted">Loading balance…</p>}</Card>
    {created && <Card className="success-panel"><p className="eyebrow">Issue created</p><h2>{created.fine.grams} g fine recorded</h2><p className="muted">Entry reference {created.id}</p>{balance ? <p className="gold-number success-balance">New balance: {balance.balance.grams} g · {pluralizeCount(balance.openJobs.length, "open job")}</p> : <p className="unavailable">Balance unavailable · <button type="button" className="retry-link" onClick={() => void loadBalance(selectedKarigar)}>Retry</button></p>}<div className="success-actions"><Link className="button button-primary" href={`/slips/${created.id}`}>Print slip</Link><Button variant="quiet" onClick={resetForm}>Record another</Button></div></Card>}
  </div>;
}
