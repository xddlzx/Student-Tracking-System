
import React, { useState } from 'react'
import { api } from '../../api'
import { useNavigate } from 'react-router-dom'

export default function NewTeacher(){
  const nav = useNavigate()
  const [full_name, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [temp_password, setTempPassword] = useState('ChangeMe!123')
  const [error, setError] = useState<string|null>(null)

  const submit = async (e:React.FormEvent)=>{
    e.preventDefault()
    try{
      await api('/teachers', { method:'POST', body: JSON.stringify({ full_name, email, username, temp_password }) })
      nav('/rooter/teachers')
    }catch(err:any){
      setError('Kaydedilemedi')
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2>Yeni Öğretmen</h2>
        <form onSubmit={submit} className="form">
          <label>Ad Soyad<input className="input" value={full_name} onChange={e=>setFullName(e.target.value)} required /></label>
          <label>E‑posta<input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
          <label>Kullanıcı Adı<input className="input" value={username} onChange={e=>setUsername(e.target.value)} required /></label>
          <label>Geçici Şifre<input className="input" value={temp_password} onChange={e=>setTempPassword(e.target.value)} required /></label>
          {error && <div style={{color:'#b91c1c'}}>{error}</div>}
          <div><button className="btn primary" type="submit">Kaydet</button></div>
        </form>
      </div>
    </div>
  )
}
