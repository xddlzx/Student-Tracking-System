import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Tabs from '../components/Tabs'
import { useTranslation } from 'react-i18next'
import { api } from '../api'

export default function StudentDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const [tab, setTab] = useState(0)
  const [student, setStudent] = useState<any>(null)

  // ⬇️ NEW
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})

  useEffect(() => {
    api(`/students/${id}`).then((s: any) => {
      setStudent(s)
      setForm(s)     // ⬅️ NEW
    }).catch(() => { })
  }, [id])

  async function save() {
    await api(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        full_name: form.full_name,
        grade: form.grade,
        class_section: form.class_section,
        guardian_name: form.guardian_name,
        guardian_phone: form.guardian_phone,
        guardian_email: form.guardian_email,
        status: form.status,
      })
    })
    const s = await api(`/students/${id}`)
    setStudent(s)
    setForm(s)
    setEditing(false)
  }

  return (
    <div className="container">
      {/* header */}
      <div className="card">
        <div className="flex justify-between items-center">
          <h2>{student ? student.full_name : t('loading')}</h2>
          {/* ⬇️ NEW: Teachers can edit */}
          {student && (
            editing
              ? <div>
                <button className="btn" onClick={() => setEditing(false)}>{t('cancel')}</button>
                <button className="btn primary" style={{ marginLeft: 8 }} onClick={save}>{t('save')}</button>
              </div>
              : <button className="btn" onClick={() => setEditing(true)}>{t('edit')}</button>
          )}
        </div>

        {/* ⬇️ NEW: very small form; fall back to read-only when not editing */}
        {student && (
          <div className="grid cols-2" style={{ marginTop: 12 }}>
            <label>Ad Soyad
              <input className="input" disabled={!editing}
                value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </label>
            <label>Sınıf
              <input className="input" type="number" disabled={!editing}
                value={form.grade || ''} onChange={e => setForm({ ...form, grade: Number(e.target.value) })} />
            </label>
            <label>Şube
              <input className="input" disabled={!editing}
                value={form.class_section || ''} onChange={e => setForm({ ...form, class_section: e.target.value })} />
            </label>
            <label>Veli Adı
              <input className="input" disabled={!editing}
                value={form.guardian_name || ''} onChange={e => setForm({ ...form, guardian_name: e.target.value })} />
            </label>
            <label>Veli Telefon
              <input className="input" disabled={!editing}
                value={form.guardian_phone || ''} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} />
            </label>
            <label>Veli E-posta
              <input className="input" type="email" disabled={!editing}
                value={form.guardian_email || ''} onChange={e => setForm({ ...form, guardian_email: e.target.value })} />
            </label>
            <label>Durum
              <input className="input" disabled={!editing}
                value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })} />
            </label>
          </div>
        )}
      </div>
      {/* keep the rest (tabs etc.) */}
    </div>
  )
}
