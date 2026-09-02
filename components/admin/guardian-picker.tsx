"use client"

import { LoaderCircle, Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { searchGuardians, type GuardianSearchResult } from "@/lib/admin/guardians"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type GuardianContactDraft = {
  guardianId: string | null
  fullName: string
  phone: string
  email: string
  relationship: string
}

export function GuardianContactList({ contacts, onChange, minimumContacts = 0 }: { contacts: GuardianContactDraft[]; onChange: (contacts: GuardianContactDraft[]) => void; minimumContacts?: number }) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<GuardianContactDraft>({ guardianId: null, fullName: "", phone: "", email: "", relationship: "" })
  const canAdd = contacts.length < 2
  function update(index: number, patch: Partial<GuardianContactDraft>) {
    onChange(contacts.map((contact, contactIndex) => contactIndex === index ? { ...contact, ...patch } : contact))
  }
  function addExisting(guardian: GuardianSearchResult) {
    if (!canAdd || contacts.some((contact) => contact.guardianId === guardian.id)) return
    onChange([...contacts, { guardianId: guardian.id, fullName: guardian.fullName, phone: guardian.phone ?? "", email: guardian.email ?? "", relationship: "" }])
  }
  function addNew() {
    if (!draft.fullName.trim() || !draft.phone.trim() || !draft.relationship.trim() || !canAdd) return
    onChange([...contacts, { ...draft, guardianId: null, fullName: draft.fullName.trim(), phone: draft.phone.trim(), email: draft.email.trim(), relationship: draft.relationship.trim() }])
    setDraft({ guardianId: null, fullName: "", phone: "", email: "", relationship: "" })
    setCreating(false)
  }
  return <section className="space-y-4"><div><h3 className="text-sm font-semibold">Contactos</h3><p className="mt-1 text-sm text-muted-foreground">Agrega hasta dos contactos. Los tutores existentes conservan sus datos.</p></div>{canAdd && !creating && <GuardianPicker selected={null} onSelect={addExisting} onClear={() => undefined} />}{canAdd && !creating && <Button type="button" variant="outline" onClick={() => setCreating(true)}>Crear contacto nuevo</Button>}{creating && <div className="space-y-3 rounded-lg border border-border p-4"><p className="text-sm font-medium">Nuevo contacto</p><Field label="Nombre completo"><Input value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} /></Field><Field label="Teléfono"><Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} inputMode="tel" /></Field><Field label="Correo (opcional)"><Input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} type="email" /></Field><Field label="Parentesco"><Input value={draft.relationship} onChange={(event) => setDraft({ ...draft, relationship: event.target.value })} /></Field><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button type="button" onClick={addNew}>Agregar contacto</Button></div></div>}{contacts.map((contact, index) => <div key={contact.guardianId ?? `new-${index}`} className="space-y-3 rounded-lg border border-border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium">{contact.guardianId ? contact.fullName : `Contacto ${index + 1}`}</p>{contact.guardianId && <p className="mt-1 text-xs text-muted-foreground">{contact.phone || "Sin teléfono"}{contact.email ? ` · ${contact.email}` : ""}</p>}</div><Button type="button" variant="ghost" size="sm" onClick={() => onChange(contacts.filter((_, contactIndex) => contactIndex !== index))}>Quitar</Button></div>{contact.guardianId ? <Field label="Parentesco"><Input value={contact.relationship} onChange={(event) => update(index, { relationship: event.target.value })} /></Field> : <><Field label="Nombre completo"><Input value={contact.fullName} onChange={(event) => update(index, { fullName: event.target.value })} /></Field><Field label="Teléfono"><Input value={contact.phone} onChange={(event) => update(index, { phone: event.target.value })} inputMode="tel" /></Field><Field label="Correo (opcional)"><Input value={contact.email} onChange={(event) => update(index, { email: event.target.value })} type="email" /></Field><Field label="Parentesco"><Input value={contact.relationship} onChange={(event) => update(index, { relationship: event.target.value })} /></Field></>}</div>) }{contacts.length < minimumContacts && <p className="text-sm text-destructive">Agrega al menos {minimumContacts} contacto{minimumContacts === 1 ? "" : "s"}.</p>}</section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}</span>{children}</label>
}

export function GuardianPicker({ selected, onSelect, onClear }: { selected: GuardianSearchResult | null; onSelect: (guardian: GuardianSearchResult) => void; onClear: () => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GuardianSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (selected || query.trim().length < 2) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const result = await searchGuardians(query)
      if (!cancelled) { setResults(result.data); setLoading(false) }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, selected])
  if (selected) return <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{selected.fullName}</p><p className="mt-1 text-xs text-muted-foreground">{selected.phone ?? "Sin teléfono"}{selected.email ? ` · ${selected.email}` : ""}</p>{selected.linkedStudents.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Relacionado con: {selected.linkedStudents.join(", ")}</p>}</div><Button type="button" variant="ghost" size="icon" aria-label="Quitar tutor seleccionado" onClick={onClear}><X /></Button></div></div>
  const visibleResults = query.trim().length >= 2 ? results : []
  return <div className="space-y-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tutor existente por nombre, teléfono o correo" className="pl-9" /></div>{loading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3 animate-spin" /> Buscando…</p>}{visibleResults.length > 0 && <div className="divide-y divide-border rounded-lg border border-border bg-white">{visibleResults.map((guardian) => <button type="button" key={guardian.id} onClick={() => { onSelect(guardian); setQuery("") }} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"><p className="font-medium">{guardian.fullName}</p><p className="text-xs text-muted-foreground">{guardian.phone ?? "Sin teléfono"}{guardian.email ? ` · ${guardian.email}` : ""}</p></button>)}</div>}</div>
}
