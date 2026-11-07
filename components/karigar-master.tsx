"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "./ui";
import { useBodyScrollLock } from "./use-body-scroll-lock";

type Rate = { categoryId: string; wastageBp: number };
type Karigar = { id: string; name: string; nameTa: string | null; code: string; phone: string; active: boolean; categoryRates: Rate[] };
type Category = { id: string; name: string; wastageBp: number };

export function KarigarMaster() {
  const [items, setItems] = useState<Karigar[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<Karigar | null>(null);
  const [message, setMessage] = useState("");
  useBodyScrollLock(editing !== null);
  useEffect(() => { Promise.all([fetch("/api/karigars"), fetch("/api/categories")]).then(async ([a, b]) => { if (!a.ok || !b.ok) throw new Error(); setItems(await a.json()); setCategories(await b.json()); }).catch(() => setError(true)); }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setMessage("");
    const form = new FormData(event.currentTarget);
    const categoryRates = Object.fromEntries(categories.map((category) => [category.id, Math.round(Number(form.get(`rate-${category.id}`) || 0) * 100)]));
    const payload = { name: String(form.get("name")), nameTa: String(form.get("nameTa") || "") || null, phone: String(form.get("phone")), active: form.get("active") === "on", categoryRates };
    const response = await fetch(editing.id ? `/api/karigars/${editing.id}` : "/api/karigars", { method: editing.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { const result = await response.json(); setMessage(result.error?.message ?? "Could not save this karigar."); return; }
    const saved = await response.json(); setItems((current) => editing.id ? current?.map((item) => item.id === saved.id ? { ...item, ...saved, categoryRates: Object.entries(categoryRates).map(([categoryId, wastageBp]) => ({ categoryId, wastageBp })) } : item) ?? null : [...(current ?? []), { ...saved, categoryRates: [] }]); setEditing(null);
  }
  return <div className="page-shell"><PageHeader eyebrow="Finance" title="Karigar master" description="Keep names, contact details and agreed wastage rates current." action={<Button onClick={() => setEditing({ id: "", name: "", nameTa: null, code: "", phone: "", active: true, categoryRates: [] })}>Add karigar</Button>} />{message && <p className="inline-error" role="alert">{message}</p>}{error ? <ErrorState /> : items === null ? <div className="loading-stack"><Skeleton /><Skeleton /></div> : !items.length ? <Card><EmptyState title="No karigars yet" message="Add the first karigar to begin." /></Card> : <Card><div className="master-list">{items.map((item) => <div className="master-row" key={item.id}><span><strong>{item.name}</strong><small>{item.nameTa || "Tamil name not set"} · {item.phone} · {item.code}</small></span><span className="row-meta"><Badge tone={item.active ? "accent" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge><Button variant="quiet" onClick={() => setEditing(item)}>Edit</Button></span></div>)}</div></Card>}{editing && <div className="modal-backdrop"><form className="surface modal" onSubmit={save}><div className="card-heading"><div><p className="eyebrow">{editing.id ? "Edit" : "New"}</p><h2>Karigar details</h2></div><button className="close-button" type="button" onClick={() => setEditing(null)} aria-label="Close">×</button></div><label>Name<input className="input" name="name" required defaultValue={editing.name} /></label><label>Tamil name<input className="input" name="nameTa" defaultValue={editing.nameTa ?? ""} /></label><label>Phone<input className="input" name="phone" required defaultValue={editing.phone} /></label><label className="check-label"><input type="checkbox" name="active" defaultChecked={editing.active} /> Active</label><fieldset><legend>Agreed wastage</legend>{categories.map((category) => <label key={category.id}>{category.name}<input className="input" name={`rate-${category.id}`} inputMode="decimal" defaultValue={((editing.categoryRates.find((rate) => rate.categoryId === category.id)?.wastageBp ?? category.wastageBp) / 100).toFixed(2)} /><small className="muted">percent</small></label>)}</fieldset><div className="modal-actions"><Button variant="quiet" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit">Save changes</Button></div></form></div>}</div>;
}
