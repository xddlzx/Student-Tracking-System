import React, { useMemo, useState } from 'react'
import { api } from '../api'

type SubjectScore = { subject_code: string; correct: number; wrong: number; blank: number }
type Props = { student: any; onSubmitted: (created:any)=>void }

const SUBJECTS: {code:string; label:string}[] = [
  { code: 'TR',  label: 'Türkçe' },
  { code: 'MAT', label: 'Matematik' },
  { code: 'FEN', label: 'Fen Bilimleri' },
  { code: 'INK', label: 'T.C. İnkılap Tarihi ve Atatürkçülük' },
  { code: 'ING', label: 'İngilizce' },
  { code: 'DIN', label: 'Din Kültürü' },
]

const DEFAULT_SUBJECTS_CONFIG_ID = '00000000-0000-0000-0000-000000000001'

export default function TrialResultForm({ student, onSubmitted }: Props){
  const [examName, setExamName] = useState<string>('')                
  const [examSource, setExamSource] = useState<string>('')            
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().slice(0,10))

  const [rows, setRows] = useState<Record<string, SubjectScore>>(() => {
    const o: Record<string, SubjectScore> = {}
    SUBJECTS.forEach(s => o[s.code] = { subject_code: s.code, correct: 0, wrong: 0, blank: 0 })
    return o
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const totals = useMemo(() => {
    let correct_total = 0, wrong_total = 0, blank_total = 0
    Object.values(rows).forEach(r => { correct_total += r.correct; wrong_total += r.wrong; blank_total += r.blank })
    const net_total = correct_total - (wrong_total * 0.3333)
    return { correct_total, wrong_total, blank_total, net_total }
  }, [rows])

  function updateField(code: string, key: keyof SubjectScore, value: number) {
    setRows(prev => ({ ...prev, [code]: { ...prev[code], [key]: Math.max(0, value || 0) }}))
  }

  async function submit(){
    setSubmitting(true); setError(null); setOkMsg(null)
    try {
      if (!examName.trim()) throw new Error('Lütfen denemenin adını yazın.')
      if (!/\d{4}-\d{2}-\d{2}/.test(examDate)) throw new Error('Geçerli bir tarih seçin.')

      const createdExam = await api('/trials', {
        method: 'POST',
        body: JSON.stringify({
          name: examName.trim(),
          source: examSource.trim() || undefined,
          date: examDate,
          grade_scope: [Number(student.grade)],
          subjects_config_id: DEFAULT_SUBJECTS_CONFIG_ID
        })
      })

      const payload = {
        student_id: student.id,
        trial_exam_id: createdExam.id,
        subjects: Object.values(rows)
      }
      const created = await api('/trial-results', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setOkMsg('Kayıt başarıyla eklendi.')
      // reset subject rows
      setRows(() => {
        const o: Record<string, SubjectScore> = {}
        SUBJECTS.forEach(s => o[s.code] = { subject_code: s.code, correct: 0, wrong: 0, blank: 0 })
        return o
      })
      // let parent know so history refetches
      onSubmitted(created)
    } catch (e:any) {
      const msg = String(e?.message || e)
      if (msg.includes('422')) {
        setError('Geçersiz giriş: soru adetlerini kontrol edin.')
      } else if (/finalized/.test(msg)) {
        setError('Bu deneme kilitlenmiş (finalize edilmiş).')
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <h3>Deneme Sonucu Ekle</h3>

      <div className="grid cols-3" style={{gap:12}}>
        <label>Deneme Adı
          <input className="input" value={examName} onChange={e=>setExamName(e.target.value)} />
        </label>
        <label>Tarih
          <input type="date" className="input" value={examDate}
                 onChange={e=>setExamDate(e.target.value)} />
        </label>
        <label>Kaynak / Yayın
          <input className="input" value={examSource} onChange={e=>setExamSource(e.target.value)} />
        </label>
      </div>

      <div className="grid cols-2" style={{marginTop:12}}>
        {SUBJECTS.map(s => (
          <div key={s.code} className="card" style={{margin:0}}>
            <div className="flex" style={{justifyContent:'space-between', marginBottom:8}}>
              <strong>{s.label}</strong><span>{s.code}</span>
            </div>
            <div className="grid cols-2">
              <label>Doğru
                <input type="number" className="input" min={0} value={rows[s.code].correct}
                  onChange={e => updateField(s.code, 'correct', Number(e.target.value))} />
              </label>
              <label>Yanlış
                <input type="number" className="input" min={0} value={rows[s.code].wrong}
                  onChange={e => updateField(s.code, 'wrong', Number(e.target.value))} />
              </label>
              <label>Boş
                <input type="number" className="input" min={0} value={rows[s.code].blank}
                  onChange={e => updateField(s.code, 'blank', Number(e.target.value))} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex" style={{justifyContent:'space-between', marginTop:12}}>
        <div>
          <strong>Toplam:</strong> Doğru {totals.correct_total} • Yanlış {totals.wrong_total} • Boş {totals.blank_total} • Net: {totals.net_total.toFixed(2)}
        </div>
        <button className="btn primary" onClick={submit} disabled={submitting}>
          {submitting ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      {okMsg && <div style={{color:'#15803d'}}>{okMsg}</div>}
      {error && <div style={{color:'#b91c1c'}}>{error}</div>}
    </div>
  )
}
