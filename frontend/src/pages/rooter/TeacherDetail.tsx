
import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../../api'

export default function TeacherDetail(){
  const { id } = useParams()
  const [teacher, setTeacher] = useState<any>(null)
  const [audit, setAudit] = useState<any[]>([])

  useEffect(()=>{
    if(!id) return
    api(`/teachers/${id}`).then(setTeacher).catch(()=>{})
    api(`/audit?actor_id=${id}`).then((r:any)=>setAudit(r.items||[])).catch(()=>{})
  }, [id])

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
          <h2 style={{margin:0}}>Öğretmen</h2>
          <Link className="btn" to="/rooter/teachers">Geri</Link>
        </div>
        {teacher && (
          <div style={{marginTop:8}}>
            <div className="grid cols-3">
              <div><strong>Ad Soyad:</strong> {teacher.full_name}</div>
              <div><strong>E‑posta:</strong> {teacher.email}</div>
              <div><strong>Kullanıcı Adı:</strong> {teacher.username}</div>
            </div>
            <div style={{marginTop:8}}>
              <strong>Kapsam:</strong> {teacher.scope && teacher.scope.length ? teacher.scope.map((s:any)=>`${s.grade}${s.class_section?(' / '+s.class_section):''}`).join(', ') : '—'}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{marginTop:12}}>
        <h3 style={{marginTop:0}}>Etkinlik (Son 200)</h3>
        <table className="table">
          <thead><tr><th>Zaman</th><th>İşlem</th><th>Varlık</th><th>Hedef</th></tr></thead>
          <tbody>
            {audit.map(a=>(
              <tr key={a.id}>
                <td>{new Date(a.ts).toLocaleString()}</td>
                <td>{a.action}</td>
                <td>{a.entity_type || '—'}</td>
                <td>
                  {a.entity_type === 'student' && a.entity_id ? <Link to={`/students/${a.entity_id}`}>Öğrenci</Link> : (a.entity_id || '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
