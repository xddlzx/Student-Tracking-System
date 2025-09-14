import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

type Workbook = { id:string; title:string; subject_code:string; grade:number; publisher?:string; total_units?:number; total_pages?:number }
type StudentWorkbook = { id:string; workbook: Workbook; status?:string; progress_percent?:number; assigned_at?:string }

type ResourceBook = { id:string; name:string; subject_code:string; progress_percent:number }
type Outcome = { outcome_id:string; subject_code:string; code:number; text:string; checked:boolean }

const SUBJECTS: {code:string; label:string}[] = [
  { code: 'TR',  label: 'Türkçe' },
  { code: 'MAT', label: 'Matematik' },
  { code: 'FEN', label: 'Fen Bilimleri' },
  { code: 'INK', label: 'İnkılap Tarihi' },
  { code: 'DIN', label: 'Din Kültürü' },
  { code: 'ING', label: 'İngilizce' },
]

export default function WorkbookTracker({ student }:{ student:any }){
  // --- existing workbook assignment ---
  const [catalog, setCatalog] = useState<Workbook[]>([])
  const [assigned, setAssigned] = useState<StudentWorkbook[]>([])
  const [pick, setPick] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // --- new: resource books ---
  const [resources, setResources] = useState<ResourceBook[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSubject, setNewSubject] = useState('TR')
  const [outcomesFor, setOutcomesFor] = useState<ResourceBook | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!student) return
    // existing
    api(`/workbooks?grade=${student.grade}`).then(setCatalog).catch(()=>setCatalog([]))
    api(`/students/${student.id}/workbooks`).then((res:any) => setAssigned(res.items || res || [])).catch(()=>setAssigned([]))
    // new
    api(`/students/${student.id}/resource-books`).then(setResources).catch(()=>setResources([]))
  }, [student?.id])

  async function assignSelected(){
    setError(null)
    try{
      if (!pick) return
      const created = await api(`/students/${student.id}/workbooks`, {
        method:'POST', body: JSON.stringify({ workbook_id: pick })
      })
      setAssigned(a => [...a, created])
      setPick('')
    }catch(e:any){
      setError('Kitap atamada hata: ' + e.message)
    }
  }

  async function updateProgress(sw: StudentWorkbook, delta: number){
    try{
      const newPct = Math.max(0, Math.min(100, (sw.progress_percent ?? 0) + delta))
      await api(`/students/${student.id}/workbooks/${sw.id}/progress`, {
        method:'POST', body: JSON.stringify({ progress_percent: newPct })
      })
      setAssigned(list => list.map(x => x.id===sw.id ? { ...x, progress_percent: newPct } : x))
    }catch(e){}
  }

  // ---- resource book helpers ----
  async function createResource(){
    if (!newName.trim()) { setError('Kaynak kitap adı zorunlu'); return }
    try{
      const created: ResourceBook = await api(`/students/${student.id}/resource-books`, {
        method:'POST', body: JSON.stringify({ name: newName.trim(), subject_code: newSubject })
      })
      setResources(prev => [...prev, created])
      setShowAdd(false); setNewName(''); setNewSubject('TR')
    }catch(e:any){
      setError('Kaynak kitap eklenemedi: ' + e.message)
    }
  }

  async function openOutcomes(rb: ResourceBook){
    setOutcomesFor(rb)
    const rows: Outcome[] = await api(`/resource-books/${rb.id}/outcomes`)
    setOutcomes(rows)
  }

  function toggleOutcome(id: string){
    setOutcomes(prev => prev.map(o => o.outcome_id===id ? ({...o, checked: !o.checked}) : o))
  }

  async function saveOutcomes(){
    if (!outcomesFor) return
    setSaving(true)
    try{
      const payload = { items: outcomes.map(o => ({ outcome_id: o.outcome_id, checked: o.checked })) }
      const res = await api(`/resource-books/${outcomesFor.id}/outcomes/toggle`, { method:'POST', body: JSON.stringify(payload) })
      // update progress in list
      setResources(list => list.map(r => r.id===outcomesFor.id ? { ...r, progress_percent: res.progress_percent ?? r.progress_percent } : r))
      setOutcomesFor(null)
    }catch(e:any){
      setError('Kazanımlar kaydedilemedi: ' + e.message)
    }finally{
      setSaving(false)
    }
  }

  function subjectLabel(code: string){
    return SUBJECTS.find(s => s.code===code)?.label || code
  }

  const outcomesProgress = useMemo(()=>{
    const total = outcomes.length
    const checked = outcomes.filter(o=>o.checked).length
    const pct = total ? Math.round(checked*100/total) : 0
    return {checked,total,pct}
  }, [outcomes])

  return (
    <div className="grid">
      {/* ---- Existing "assign catalog workbook" section ---- */}
      <div className="card">
        <div className="flex" style={{justifyContent:'space-between'}}>
          <h3>Kitaplar (katalog)</h3>
          <div className="flex">
            <select className="input" value={pick} onChange={e=>setPick(e.target.value)} style={{minWidth:240}}>
              <option value="">Sınıfa uygun bir kitap seçin…</option>
              {catalog.map(w => (
                <option key={w.id} value={w.id}>{w.title} · {w.subject_code} · {w.grade}.sınıf</option>
              ))}
            </select>
            <button className="btn primary" onClick={assignSelected} disabled={!pick}>Ata</button>
          </div>
        </div>
        <table className="table" style={{marginTop:8}}>
          <thead>
            <tr><th>Kitap</th><th>İlerleme</th><th>Hızlı Güncelle</th></tr>
          </thead>
          <tbody>
            {assigned.map(sw => (
              <tr key={sw.id}>
                <td>{sw.workbook?.title}</td>
                <td>{(sw.progress_percent ?? 0)}%</td>
                <td className="flex" style={{gap:6}}>
                  <button className="btn" onClick={()=>updateProgress(sw, +5)}>+5%</button>
                  <button className="btn" onClick={()=>updateProgress(sw, -5)}>-5%</button>
                </td>
              </tr>
            ))}
            {assigned.length===0 && (
              <tr><td colSpan={3} style={{color:'#6b7280'}}>Henüz atanmış kitap yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---- NEW: Resource books with outcomes ---- */}
      <div className="card">
        <div className="flex" style={{justifyContent:'space-between'}}>
          <h3>Kaynak Kitaplar (kazanım takibi)</h3>
          <button className="btn primary" onClick={()=>setShowAdd(true)}>Kaynak Kitap Ekle</button>
        </div>

        <table className="table" style={{marginTop:8}}>
          <thead>
            <tr><th>Adı</th><th>Branş</th><th>İlerleme</th></tr>
          </thead>
          <tbody>
            {resources.map(rb => (
              <tr key={rb.id} onClick={()=>openOutcomes(rb)} style={{cursor:'pointer'}}>
                <td>{rb.name}</td>
                <td><span className="badge">{subjectLabel(rb.subject_code)}</span></td>
                <td>{rb.progress_percent}%</td>
              </tr>
            ))}
            {resources.length===0 && (
              <tr><td colSpan={3} style={{color:'#6b7280'}}>Henüz kaynak kitap eklenmedi.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <div style={{color:'#b91c1c'}}>{error}</div>}

      {/* Add Resource modal */}
      {showAdd && (
        <div className="overlay">
          <div className="modal">
            <h3>Kaynak Kitap Ekle</h3>
            <div className="grid">
              <label>
                <div>Kaynak kitap adı</div>
                <input className="input" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Örn: Paragraf Soru Bankası" />
              </label>
              <label>
                <div>Branş</div>
                <select className="input" value={newSubject} onChange={e=>setNewSubject(e.target.value)}>
                  {SUBJECTS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <div className="flex" style={{justifyContent:'flex-end', marginTop:12}}>
              <button className="btn" onClick={()=>setShowAdd(false)}>Vazgeç</button>
              <button className="btn primary" onClick={createResource}>Ekle</button>
            </div>
          </div>
        </div>
      )}

      {/* Outcomes modal */}
      {outcomesFor && (
        <div className="overlay">
          <div className="modal" style={{maxWidth:700}}>
            <h3>{outcomesFor.name} · {subjectLabel(outcomesFor.subject_code)} <span style={{fontWeight:400, color:'#6b7280'}}>({outcomesProgress.pct}%)</span></h3>
            <div style={{maxHeight:380, overflow:'auto', border:'1px solid #eee', borderRadius:8, padding:8}}>
              {outcomes.map(o => (
                <label key={o.outcome_id} className="flex" style={{justifyContent:'space-between', padding:'6px 4px', borderBottom:'1px dashed #f0f0f0'}}>
                  <div><input type="checkbox" checked={o.checked} onChange={()=>toggleOutcome(o.outcome_id)} /> <span style={{marginLeft:8}}>{o.code}. {o.text}</span></div>
                </label>
              ))}
            </div>
            <div className="flex" style={{justifyContent:'space-between', marginTop:10}}>
              <div>{outcomesProgress.checked}/{outcomesProgress.total} işaretli</div>
              <div className="flex">
                <button className="btn" onClick={()=>setOutcomesFor(null)} disabled={saving}>Kapat</button>
                <button className="btn primary" onClick={saveOutcomes} disabled={saving}>{saving?'Kaydediliyor…':'Kaydet'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .overlay{ position:fixed; inset:0; background:rgba(0,0,0,.2); display:flex; align-items:center; justify-content:center; z-index:50 }
        .modal{ background:#fff; border-radius:12px; padding:16px; width:100%; max-width:520px; box-shadow:0 10px 30px rgba(0,0,0,.15) }
        .modal h3{ margin-top:0 }
      `}</style>
    </div>
  )
}
