import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

// --- types ---
type Workbook = { id: string; title: string; subject_code: string; grade: number; publisher?: string; total_units?: number; total_pages?: number }
type StudentWorkbook = { id: string; workbook: Workbook; status?: string; progress_percent?: number; assigned_at?: string }

type ResourceBook = { id: string; name: string; subject_code: string; progress_percent: number }
type Outcome = { outcome_id: string; subject_code: string; code: number; text: string; checked: boolean }

type Props = { student: any }

const SUBJECTS: { code: string; label: string }[] = [
  { code: 'TR', label: 'Türkçe' },
  { code: 'MAT', label: 'Matematik' },
  { code: 'FEN', label: 'Fen Bilimleri' },
  { code: 'INK', label: 'İnkılap Tarihi' },
  { code: 'DIN', label: 'Din Kültürü' },
  { code: 'ING', label: 'İngilizce' },
]

// --- tiny UI helpers ---
function subjectLabel(code: string) {
  return SUBJECTS.find(s => s.code === code)?.label || code
}

function clamp(n: number, min = 0, max = 100) { return Math.max(min, Math.min(max, n)) }

function Progress({ value, compact = false }: { value: number; compact?: boolean }) {
  const v = clamp(Math.round(value))
  return (
    <div className={compact ? 'progress compact' : 'progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} role="progressbar">
      <div className="progress-bar" style={{ width: `${v}%` }} />
      <span className="progress-label">{v}%</span>
    </div>
  )
}

export default function WorkbookTracker({ student }: Props) {
  // --- existing workbook assignment ---
  const [catalog, setCatalog] = useState<Workbook[]>([])
  const [assigned, setAssigned] = useState<StudentWorkbook[]>([])
  const [pick, setPick] = useState<string>('')

  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [loadingAssigned, setLoadingAssigned] = useState(false)

  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // --- new: resource books ---
  const [resources, setResources] = useState<ResourceBook[]>([])
  const [loadingResources, setLoadingResources] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubject, setNewSubject] = useState('TR')

  const [outcomesFor, setOutcomesFor] = useState<ResourceBook | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [outcomeQuery, setOutcomeQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!student) return

    setLoadingCatalog(true)
    api(`/workbooks?grade=${student.grade}`)
      .then(setCatalog)
      .catch(() => setCatalog([]))
      .finally(() => setLoadingCatalog(false))

    setLoadingAssigned(true)
    api(`/students/${student.id}/workbooks`)
      .then((res: any) => setAssigned(res.items || res || []))
      .catch(() => setAssigned([]))
      .finally(() => setLoadingAssigned(false))

    setLoadingResources(true)
    api(`/students/${student.id}/resource-books`)
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoadingResources(false))
  }, [student?.id])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  useEffect(() => {
    if (!statusMsg) return
    const t = setTimeout(() => setStatusMsg(null), 2500)
    return () => clearTimeout(t)
  }, [statusMsg])

  async function assignSelected() {
    setError(null)
    try {
      if (!pick) return
      const created = await api(`/students/${student.id}/workbooks`, {
        method: 'POST', body: JSON.stringify({ workbook_id: pick })
      })
      setAssigned(a => [...a, created])
      setPick('')
      setStatusMsg('Kitap atandı!')
    } catch (e: any) {
      setError('Kitap atamada hata: ' + e.message)
    }
  }

  async function updateProgress(sw: StudentWorkbook, delta: number) {
    try {
      const newPct = clamp((sw.progress_percent ?? 0) + delta)
      await api(`/students/${student.id}/workbooks/${sw.id}/progress`, {
        method: 'POST', body: JSON.stringify({ progress_percent: newPct })
      })
      setAssigned(list => list.map(x => x.id === sw.id ? { ...x, progress_percent: newPct } : x))
    } catch (e) { setError('İlerleme güncellenemedi') }
  }

  async function setProgress(sw: StudentWorkbook, newPct: number) {
    try {
      const v = clamp(newPct)
      await api(`/students/${student.id}/workbooks/${sw.id}/progress`, {
        method: 'POST', body: JSON.stringify({ progress_percent: v })
      })
      setAssigned(list => list.map(x => x.id === sw.id ? { ...x, progress_percent: v } : x))
    } catch (e) { setError('İlerleme güncellenemedi') }
  }

  // ---- resource book helpers ----
  async function createResource() {
    if (!newName.trim()) { setError('Kaynak kitap adı zorunlu'); return }
    try {
      const created: ResourceBook = await api(`/students/${student.id}/resource-books`, {
        method: 'POST', body: JSON.stringify({ name: newName.trim(), subject_code: newSubject })
      })
      setResources(prev => [...prev, created])
      setShowAdd(false); setNewName(''); setNewSubject('TR')
      setStatusMsg('Kaynak kitap eklendi!')
    } catch (e: any) {
      setError('Kaynak kitap eklenemedi: ' + e.message)
    }
  }

  async function openOutcomes(rb: ResourceBook) {
    setOutcomesFor(rb)
    setOutcomeQuery('')
    const rows: Outcome[] = await api(`/resource-books/${rb.id}/outcomes`).catch(() => [])
    setOutcomes(rows)
  }

  function toggleOutcome(id: string) {
    setOutcomes(prev => prev.map(o => o.outcome_id === id ? ({ ...o, checked: !o.checked }) : o))
  }

  function setAllOutcomes(checked: boolean) {
    setOutcomes(prev => prev.map(o => ({ ...o, checked })))
  }

  async function saveOutcomes() {
    if (!outcomesFor) return
    setSaving(true)
    try {
      const payload = { items: outcomes.map(o => ({ outcome_id: o.outcome_id, checked: o.checked })) }
      const res = await api(`/resource-books/${outcomesFor.id}/outcomes/toggle`, { method: 'POST', body: JSON.stringify(payload) })
      // update progress in list
      setResources(list => list.map(r => r.id === outcomesFor.id ? { ...r, progress_percent: res.progress_percent ?? r.progress_percent } : r))
      setOutcomesFor(null)
      setStatusMsg('Kazanımlar kaydedildi!')
    } catch (e: any) {
      setError('Kazanımlar kaydedilemedi: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredOutcomes = useMemo(() => {
    const q = outcomeQuery.trim().toLowerCase()
    if (!q) return outcomes
    return outcomes.filter(o => `${o.code}. ${o.text}`.toLowerCase().includes(q))
  }, [outcomes, outcomeQuery])

  const outcomesProgress = useMemo(() => {
    const total = outcomes.length
    const checked = outcomes.filter(o => o.checked).length
    const pct = total ? Math.round(checked * 100 / total) : 0
    return { checked, total, pct }
  }, [outcomes])

  return (
    <div className="page-grid">
      {/* ---- NEW: Resource books with outcomes ---- */}
      <section className="card">
        <header className="section-header">
          <div>
            <h3>Kaynak Kitaplar</h3>
            <small className="muted">{resources.length} kitap</small>
          </div>
          <button className="btn primary" onClick={() => setShowAdd(true)}>Kaynak Kitap Ekle</button>
        </header>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Adı</th><th>Branş</th><th>İlerleme</th></tr>
            </thead>
            <tbody>
              {loadingResources ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}><td colSpan={3}><div className="skeleton" style={{ height: 18 }} /></td></tr>
                ))
              ) : resources.length > 0 ? resources.map(rb => (
                <tr key={rb.id}
                  onClick={() => openOutcomes(rb)}
                  onKeyDown={e => { if (e.key === 'Enter') openOutcomes(rb) }}
                  tabIndex={0}
                  className="row-link">
                  <td>
                    <div className="cell-title">{rb.name}</div>
                    <div className="cell-sub">Detayları açmak için tıklayın</div>
                  </td>
                  <td><span className="badge">{subjectLabel(rb.subject_code)}</span></td>
                  <td><Progress value={rb.progress_percent} compact /></td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="empty">Henüz kaynak kitap eklenmedi.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* global messages */}
      {statusMsg && <div className="toast ok" role="status">{statusMsg}</div>}
      {error && <div className="toast err" role="alert">{error}</div>}

      {/* Add Resource modal */}
      {showAdd && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>Kaynak Kitap Ekle</h3>
            <div className="grid-2">
              <label>
                <div>Kaynak kitap adı</div>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Örn: Paragraf Soru Bankası" />
              </label>
              <label>
                <div>Branş</div>
                <select className="input" value={newSubject} onChange={e => setNewSubject(e.target.value)}>
                  {SUBJECTS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowAdd(false)}>Vazgeç</button>
              <button className="btn primary" onClick={createResource}>Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Outcomes modal */}
      {outcomesFor && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal lg">
            <header className="modal-head">
              <h3>{outcomesFor.name} · {subjectLabel(outcomesFor.subject_code)}</h3>
              <div className="head-right">
                <Progress value={outcomesProgress.pct} compact />
                <span className="muted">{outcomesProgress.checked}/{outcomesProgress.total} işaretli</span>
              </div>
            </header>

            <div className="subtoolbar">
              <input className="input" placeholder="Kazanımlarda ara…" value={outcomeQuery} onChange={e => setOutcomeQuery(e.target.value)} />
              <div className="toolbar">
                <button className="btn" onClick={() => setAllOutcomes(true)}>Tümünü Seç</button>
                <button className="btn" onClick={() => setAllOutcomes(false)}>Tümünü Kaldır</button>
              </div>
            </div>

            <div className="outcome-list" role="list">
              {filteredOutcomes.map(o => (
                <label key={o.outcome_id} className="outcome-item" role="listitem">
                  <div className="outcome-text"><input type="checkbox" checked={o.checked} onChange={() => toggleOutcome(o.outcome_id)} /> <span>{o.code}. {o.text}</span></div>
                </label>
              ))}
              {filteredOutcomes.length === 0 && (
                <div className="empty muted">Sonuç bulunamadı.</div>
              )}
            </div>

            <footer className="modal-actions sticky">
              <button className="btn" onClick={() => setOutcomesFor(null)} disabled={saving}>Kapat</button>
              <button className="btn primary" onClick={saveOutcomes} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
            </footer>
          </div>
        </div>
      )}

      {/* scoped styles */}
      <style>{`
        .page-grid{ display:grid; grid-template-columns:1fr; gap:16px }
        .section-header{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px }
        .toolbar{ display:flex; align-items:center; gap:8px }
        .table-wrap{ overflow:auto; border:1px solid #eee; border-radius:12px }
        .cell-title{ font-weight:600 }
        .cell-sub{ font-size:12px; color:#6b7280 }
        .row-link{ cursor:pointer }
        .row-link:focus{ outline:2px solid #3b82f6; outline-offset:-2px }
        .empty{ color:#6b7280; text-align:center }
        .muted{ color:#6b7280 }

        .quick-actions{ display:flex; align-items:center; gap:8px }
        .quick-actions input[type="range"]{ width:140px }

        .progress{ position:relative; height:16px; background:#f3f4f6; border-radius:999px; overflow:hidden; min-width:120px }
        .progress.compact{ height:12px; min-width:100px }
        .progress-bar{ position:absolute; inset:0 auto 0 0; background:linear-gradient(90deg, #60a5fa, #34d399); }
        .progress-label{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:11px; color:#111827 }

        .skeleton{ background:linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6); background-size:200% 100%; animation:shimmer 1.2s infinite; border-radius:8px }
        @keyframes shimmer{ 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        .toast{ position:fixed; right:16px; bottom:16px; z-index:60; padding:10px 12px; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.18); color:#111 }
        .toast.ok{ background:#ecfeff; border:1px solid #a5f3fc }
        .toast.err{ background:#fef2f2; border:1px solid #fecaca }

        .overlay{ position:fixed; inset:0; background:rgba(0,0,0,.25); display:flex; align-items:center; justify-content:center; z-index:50; padding:16px }
        .modal{ background:#fff; border-radius:16px; padding:16px; width:100%; max-width:560px; box-shadow:0 10px 30px rgba(0,0,0,.15) }
        .modal.lg{ max-width:760px }
        .modal h3{ margin:0 0 8px 0 }
        .modal-actions{ display:flex; justify-content:flex-end; gap:8px; margin-top:12px }
        .modal-actions.sticky{ position:sticky; bottom:0; background:#fff; padding-top:12px }
        .modal-head{ display:flex; align-items:center; justify-content:space-between; gap:12px }
        .head-right{ display:flex; align-items:center; gap:8px }
        .subtoolbar{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin:10px 0 }
        .grid-2{ display:grid; gap:8px; grid-template-columns:1fr 220px }

        .outcome-list{ max-height:420px; overflow:auto; border:1px solid #eee; border-radius:12px }
        .outcome-item{ display:flex; justify-content:space-between; padding:8px 10px; border-bottom:1px dashed #f0f0f0 }
        .outcome-item:last-child{ border-bottom:none }
        .outcome-text{ display:flex; gap:8px; align-items:center }
      `}</style>
    </div>
  )
}
