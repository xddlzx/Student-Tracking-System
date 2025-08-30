import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api'

export default function Login(){
  const { t } = useTranslation()
  const [id, setId] = useState('teacher1')
  const [password, setPassword] = useState('ChangeMe!123')
  const [error, setError] = useState<string|null>(null)

  const submit = async (e:React.FormEvent)=>{
    e.preventDefault()
    try{
      setError(null)
      await api('/auth/login', { method:'POST', body: JSON.stringify({ username:id, password })})
      window.location.href = '/dashboard'
    }catch(err:any){
      setError('Giriş başarısız')
    }
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:420, margin:'80px auto'}}>
        <h2>{t('login.title')}</h2>
        <form onSubmit={submit} className="grid">
          <label>
            {t('login.username_or_email')}
            <input className="input" value={id} onChange={e=>setId(e.target.value)} />
          </label>
          <label>
            {t('login.password')}
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </label>
          {error && <div style={{color:'#b91c1c'}}>{error}</div>}
          <button className="btn primary">{t('login.submit')}</button>
        </form>
      </div>
    </div>
  )
}
