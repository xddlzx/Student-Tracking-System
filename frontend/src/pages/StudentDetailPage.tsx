import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Tabs from '../components/Tabs'
import Sparkline from '../components/Sparkline'
import { useTranslation } from 'react-i18next'
import { api } from '../api'

export default function StudentDetailPage(){
  const { id } = useParams()
  const { t } = useTranslation()
  const [tab, setTab] = useState(0)
  const [student, setStudent] = useState<any>(null)

  useEffect(()=>{
    api(`/students/${id}`).then(setStudent).catch(()=>{})
  }, [id])

  if(!student) return <div className="container"><div className="card">Yükleniyor…</div></div>

  return (
    <div className="container">
      <div className="card">
        <h2>{student.full_name} ({student.grade}/{student.class_section})</h2>
        <Tabs tabs={[t('student.overview'), t('student.trials'), t('student.workbooks'), t('student.notes'), t('student.activity')]}
              active={tab} onChange={setTab} />
        {tab===0 && <div>
          <div className="grid cols-2">
            <div><strong>Veli:</strong> {student.guardian_name || '-'} – {student.guardian_phone || '-'}</div>
            <div><strong>Durum:</strong> {student.status}</div>
          </div>
          <div style={{marginTop:12}}><Sparkline /></div>
        </div>}
        {tab===1 && <div>Denemeler (örnek grafik yeri)</div>}
        {tab===2 && <div>Kitaplar (atama ve ilerleme)</div>}
        {tab===3 && <div>Notlar</div>}
        {tab===4 && <div>Etkinlik</div>}
      </div>
    </div>
  )
}
