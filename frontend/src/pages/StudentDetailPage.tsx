
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Tabs from '../components/Tabs'
import { useTranslation } from 'react-i18next'
import { api } from '../api'
import TrialResultForm from '../components/TrialResultForm'
import TrialHistory from '../components/TrialHistory'
import WorkbookTracker from '../components/WorkbookTracker'

export default function StudentDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const [tab, setTab] = useState(0)
  const [student, setStudent] = useState<any>(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    if (!id) return
    api(`/students/${id}`).then(st => { setStudent(st); setForm(st) })
  }, [id])

  async function save(){
    await api(`/students/${id}`, { method: 'PUT', body: JSON.stringify(form) })
    setEditing(false)
    const st = await api(`/students/${id}`); setStudent(st); setForm(st)
  }

  if (!student) return <div className="container"><div className="card">Yükleniyor…</div></div>

  return (
    <div className="container">
      <div className="card">
        <div className="flex" style={{justifyContent:'space-between'}}>
          <h2>{student.full_name} <span className="badge">{student.grade}</span> {student.class_section}</h2>
          <div className="flex">
            {!editing ? <button className="btn" onClick={() => setEditing(true)}>Düzenle</button> :
              (<>
                <button className="btn" onClick={() => (setEditing(false), setForm(student))}>Vazgeç</button>
                <button className="btn primary" onClick={save} style={{marginLeft:8}}>Kaydet</button>
              </>)
            }
          </div>
        </div>
        <Tabs tabs={[t('student.overview'), t('student.trials'), t('student.workbooks')]} active={tab} onChange={setTab} />
        {tab === 0 && (
          <div className="grid cols-2">
            <label>Veli Adı
              <input className="input" disabled={!editing}
                value={form.guardian_name || ''} onChange={e => setForm({ ...form, guardian_name: e.target.value })} />
            </label>
            <label>Veli Tel
              <input className="input" disabled={!editing}
                value={form.guardian_phone || ''} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} />
            </label>
            <label>Veli E‑posta
              <input className="input" type="email" disabled={!editing}
                value={form.guardian_email || ''} onChange={e => setForm({ ...form, guardian_email: e.target.value })} />
            </label>
            <label>Durum
              <input className="input" disabled={!editing}
                value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })} />
            </label>
          </div>
        )}
        {tab === 1 && (
          <div className="grid">
            <TrialResultForm student={student} onSubmitted={() => { /* refresh via TrialHistory useEffect */ }} />
            <TrialHistory student={student} />
          </div>
        )}
        {tab === 2 && (
          <WorkbookTracker student={student} />
        )}
      </div>
    </div>
  )
}
