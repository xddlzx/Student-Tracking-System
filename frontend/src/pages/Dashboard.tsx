import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GradeFilter from '../components/GradeFilter'
import StudentTable from '../components/StudentTable'
import { api } from '../api'

export default function Dashboard(){
  const { t } = useTranslation()
  const [grade, setGrade] = useState<number|null>(8)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<any[]>([])

  useEffect(()=>{
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (grade) params.set('grade', String(grade))
    if (q) params.set('q', q)
    api(`/students?${params.toString()}`, { signal: controller.signal })
      .then((r:any)=>setItems(r.items || []))
      .catch(()=>{})
    return ()=>controller.abort()
  }, [grade, q])

  return (
    <div className="container">
      <div className="flex" style={{justifyContent:'space-between'}}>
        <h2>{t('dashboard.title')}</h2>
        <a className="btn" href="/login" onClick={async (e)=>{e.preventDefault(); await api('/auth/logout',{method:'POST'}); window.location.href='/login'}}>{t('login.logout')}</a>
      </div>
      <div className="card">
        <div className="flex" style={{justifyContent:'space-between'}}>
          <div>
            <div style={{marginBottom:8}}>{t('dashboard.grades')}</div>
            <GradeFilter value={grade} onChange={setGrade} />
          </div>
          <div style={{width:280}}>
            <input className="input" placeholder={t('dashboard.search')} value={q} onChange={e=>setQ(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="card">
        <StudentTable items={items} />
      </div>
    </div>
  )
}
