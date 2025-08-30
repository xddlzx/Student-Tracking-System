
import React, { useState } from 'react'
import { api } from '../../api'
import { useNavigate } from 'react-router-dom'

export default function NewStudent(){
  const nav = useNavigate()
  const [full_name, setFullName] = useState('')
  const [grade, setGrade] = useState<number>(8)
  const [class_section, setClassSection] = useState('A')
  const [guardian_name, setGuardianName] = useState('')
  const [guardian_phone, setGuardianPhone] = useState('')
  const [guardian_email, setGuardianEmail] = useState('')
  const [error, setError] = useState<string|null>(null)

  const submit = async (e:React.FormEvent)=>{
    e.preventDefault()
    try{
      await api('/students', { method:'POST', body: JSON.stringify({ full_name, grade, class_section, guardian_name, guardian_phone, guardian_email }) })
      nav('/dashboard')
    }catch(err:any){
      setError('Kaydedilemedi')
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Yeni Öğrenci</h2>
        <form onSubmit={submit} className="form">
          <label>Ad Soyad<input className="input" value={full_name} onChange={e=>setFullName(e.target.value)} required /></label>
          <label>Sınıf (Grade)
            <input className="input" type="number" min={1} max={12} value={grade} onChange={e=>setGrade(parseInt(e.target.value||'8'))} required />
          </label>
          <label>Şube<input className="input" value={class_section} onChange={e=>setClassSection(e.target.value)} required /></label>
          <div className="grid cols-2">
            <label>Veli Adı<input className="input" value={guardian_name} onChange={e=>setGuardianName(e.target.value)} /></label>
            <label>Veli Telefon<input className="input" value={guardian_phone} onChange={e=>setGuardianPhone(e.target.value)} /></label>
          </div>
          <label>Veli E‑posta<input className="input" type="email" value={guardian_email} onChange={e=>setGuardianEmail(e.target.value)} /></label>
          {error && <div style={{color:'#b91c1c'}}>{error}</div>}
          <div><button className="btn primary" type="submit">Kaydet</button></div>
        </form>
      </div>
    </div>
  )
}
