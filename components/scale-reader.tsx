"use client";

import { useEffect, useState } from "react";
import { aiResolutionEvidence, canUseScaleReading, readScalePhoto, scaleValuesDiffer, type ScaleResponse } from "../lib/scale-reader";
import { Badge, Button } from "./ui";

export type AiEvidence = {
  aiReadingMg?: string;
  aiReadingPurityBp?: number;
  aiResolution: "NONE" | "USED_AI" | "KEPT_TYPED";
};

type Props = {
  weight: string;
  purity: string;
  onWeight: (value: string) => void;
  onPurity: (value: string) => void;
  onEvidence: (value: AiEvidence) => void;
};

export function ScaleReader({ weight, purity, onWeight, onPurity, onEvidence }: Props) {
  const [reading, setReading] = useState<ScaleResponse | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resolution, setResolution] = useState<"USED_AI" | "KEPT_TYPED" | null>(null);
  const mismatch = reading?.status === "ok" || reading?.status === "low_confidence"
    ? !resolution && scaleValuesDiffer(reading, weight, purity)
    : false;

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  async function choose(file: File) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setPending(true);
    setResolution(null);
    onEvidence({ aiResolution: "NONE" });
    try {
      const result = await readScalePhoto(file);
      setReading(result);
      if (result.weight || result.purity) {
        onEvidence({
          aiReadingMg: result.weight?.mg,
          aiReadingPurityBp: result.purity?.bp,
          aiResolution: "NONE",
        });
      }
    } catch (error) {
      setReading({ status: "unavailable", weight: null, purity: null, confidence: null, message: error instanceof Error ? error.message : "Could not read the photo." });
    } finally {
      setPending(false);
    }
  }

  function useAi() {
    if (!reading) return;
    if (reading.weight) onWeight(reading.weight.grams);
    if (reading.purity) onPurity(reading.purity.percent);
    setResolution("USED_AI");
    onEvidence(aiResolutionEvidence("USED_AI", reading));
  }

  function keepTyped() {
    setResolution("KEPT_TYPED");
    if (reading) onEvidence(aiResolutionEvidence("KEPT_TYPED", reading));
  }

  function changeResolution() {
    setResolution(null);
    if (reading) onEvidence({ ...aiResolutionEvidence("KEPT_TYPED", reading), aiResolution: "NONE" });
  }

  const weightText = reading?.weight?.grams ?? "Weight not read";
  const purityText = reading?.purity?.percent ? `${reading.purity.percent}%` : "Purity not read";

  return <div className="scale-reader">
    <label className="button button-quiet scale-upload">Add photo of scale or meter
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void choose(file); }} />
    </label>
    {pending && <p className="muted" role="status">Reading photo…</p>}
    {photoUrl && <div className="scale-reading">
      {/* Blob URLs are local request previews and cannot use Next's image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt="Scale or karat-meter photo preview" className="scale-thumbnail" />
      {reading && <div className="scale-result">
        {reading.mock && <small className="muted">Demo reading (no AI key configured)</small>}
        <div className="card-heading"><strong>AI reading</strong>{reading.confidence && <Badge tone={reading.confidence === "high" ? "accent" : reading.confidence === "medium" ? "neutral" : "danger"}>{reading.confidence}</Badge>}</div>
        <p className="hero-number gold-number">{reading.weight?.grams ?? "—"}{reading.weight && <span> g</span>}</p>
        <p className="metric-label"><span>Purity</span> <span>{purityText}</span></p>
        <p className="muted">{reading.message}</p>
        {canUseScaleReading(reading) && <Button type="button" variant="quiet" onClick={useAi}>Use this reading</Button>}
      </div>}
    </div>}
    {mismatch && <div className="mismatch-panel" role="alert"><strong>Reading differs from typed value</strong><div><span>AI: {weightText} / {purityText}</span><span>Typed: {weight || "—"} g / {purity || "—"}%</span></div><div className="modal-actions"><Button type="button" variant="quiet" onClick={useAi}>Use AI value</Button><Button type="button" onClick={keepTyped}>Keep my value (I checked the scale)</Button></div></div>}
    {resolution && reading && <p className="ai-confirmation" role="status">{resolution === "USED_AI" ? `Using the AI reading: ${reading.weight?.grams ?? "weight not read"}${reading.weight ? " g" : ""}` : `Keeping your typed value: ${weight || "weight not entered"}${weight ? " g" : ""}`} · <button type="button" className="retry-link" onClick={changeResolution}>Change</button></p>}
  </div>;
}
