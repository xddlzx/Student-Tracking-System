
import React, { useEffect, useState } from 'react'
import { api } from '../api'

type Workbook = { id:string; title:string; subject_code:string; grade:number; publisher?:string; total_units?:number; total_pages?:number }
type StudentWorkbook = { id:string; workbook: Workbook; status?:string; progress_percent?:number; assigned_at?:string }

export default function WorkbookTracker({ student }:{ student:any }){
  const [catalog, setCatalog] = useState<Workbook[]>([])
  const [assigned, setAssigned] = useState<StudentWorkbook[]>([])
  const [pick, setPick] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    api(`/workbooks?grade=${student.grade}`).then(setCatalog).catch(()=>setCatalog([]))
    api(`/students/${student.id}/workbooks`).then((res:any) => setAssigned(res.items || res || [])).catch(()=>setAssigned([]))
  }, [student?.id])

  function assign(){
    if (!pick) return
    api(`/students/${student.id}/workbooks`, { method: 'POST', body: JSON.stringify({ workbook_id: pick })})
      .then((sw:any) => setAssigned(prev => [sw, ...prev]))
      .catch(e => setError(`Atanamadı: ${e?.message||e}`))
  }

  function updateProgress(sw: StudentWorkbook, delta:number){
    const next = Math.max(0, Math.min(100, (sw.progress_percent||0) + delta))
    api(`/students/${student.id}/workbooks/${sw.id}`, { method: 'PUT', body: JSON.stringify({ progress_percent: next })})
      .then((upd:any) => setAssigned(prev => prev.map(x => x.id===sw.id ? { ...x, progress_percent: next } : x)))
      .catch(()=>{})
  }

  return (
    <div className="card">
      <h3>Kaynak / Soru Bankası Takibi</h3>
      <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
        <select className="input" style={{ minWidth: 260 }} value={pick} onChange={e=>setPick(e.target.value)}>
          <option value="">Kitap seçin…</option>
          {catalog.map(w => (
            <option key={w.id} value={w.id}>{w.subject_code} • {w.title} {w.publisher?`(${w.publisher})`:''}</option>
          ))}
        </select>
        <button className="btn" onClick={assign}>Ekle</button>
      </div>

      <table className="table">
        <thead><tr><th>Ders</th><th>Kitap</th><th>İlerleme</th><th></th></tr></thead>
        <tbody>
          {assigned.map(sw => (
            <tr key={sw.id}>
              <td>{sw.workbook?.subject_code}</td>
              <td>{sw.workbook?.title}</td>
              <td>{(sw.progress_percent ?? 0)}%</td>
              <td className="flex" style={{gap:6}}>
                <button className="btn" onClick={()=>updateProgress(sw, +5)}>+5%</button>
                <button className="btn" onClick={()=>updateProgress(sw, -5)}>-5%</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <div style={{color:'#b91c1c', marginTop:8}}>{error}</div>}
    </div>
  )
}
