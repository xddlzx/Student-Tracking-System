
import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

type TrialExam = { id: string; name: string; source?: string; date: string; grade_scope: number[]; subjects_config_id: string; is_finalized: boolean }
type SubjectScore = { subject_code: string; correct: number; wrong: number; blank: number }
type Props = { student: any; onSubmitted: (created:any)=>void }

const SUBJECTS: {code:string; label:string}[] = [
  { code: 'TR',  label: 'Türkçe' },
  { code: 'MAT', label: 'Matematik' },
  { code: 'FEN', label: 'Fen Bilimleri' },
  { code: 'SOS', label: 'Sosyal Bilgiler' },
  { code: 'ING', label: 'İngilizce' },
  { code: 'DIN', label: 'Din Kültürü' },
]

export default function TrialResultForm({ student, onSubmitted }: Props){
  const [trials, setTrials] = useState<TrialExam[]>([])
  const [selected, setSelected] = useState<string>('')
  const [rows, setRows] = useState<Record<string, SubjectScore>>(() => {
    const o: Record<string, SubjectScore> = {}
    SUBJECTS.forEach(s => o[s.code] = { subject_code: s.code, correct: 0, wrong: 0, blank: 0 })
    return o
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string| null>(null)

  useEffect(() => {
    if (!student) return
    api(`/trials?grade=${student.grade}`).then((items:TrialExam[]) => {
      setTrials(items || [])
      if (items && items.length) setSelected(items[0].id)
    }).catch(() => setTrials([]))
  }, [student?.id])

  const totals = useMemo(() => {
    let correct_total = 0, wrong_total = 0, blank_total = 0
    Object.values(rows).forEach(r => {
      correct_total += Number(r.correct||0)
      wrong_total   += Number(r.wrong||0)
      blank_total   += Number(r.blank||0)
    })
    // NOTE: Backend calculates net using configured penalty; we only compute a naive net with 0.25 as a hint.
    const net_total = correct_total - wrong_total * 0.25
    return { correct_total, wrong_total, blank_total, net_total }
  }, [rows])

  function updateField(code:string, field:keyof SubjectScore, value:number){
    setRows(prev => ({ ...prev, [code]: { ...prev[code], [field]: value } }))
  }

  async function submit(){
    if (!selected) { setError('Lütfen bir deneme seçin.'); return }
    setSubmitting(true); setError(null)
    try {
      const payload = {
        student_id: student.id,
        trial_exam_id: selected,
        subjects: Object.values(rows),
      }
      const created = await api('/trial-results', { method: 'POST', body: JSON.stringify(payload) })
      onSubmitted(created)
      // reset inputs
      setRows(() => {
        const o: Record<string, SubjectScore> = {}
        SUBJECTS.forEach(s => o[s.code] = { subject_code: s.code, correct: 0, wrong: 0, blank: 0 })
        return o
      })
    } catch (e:any) {
      setError(`Kaydedilemedi: ${e?.message || e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card">
      <div className="flex" style={{justifyContent:'space-between'}}>
        <h3>Yeni Deneme Sonucu</h3>
        <div style={{minWidth:260}}>
          <select className="input" value={selected} onChange={e=>setSelected(e.target.value)}>
            {trials.map(t => (
              <option key={t.id} value={t.id}>{new Date(t.date).toLocaleDateString()} • {t.name}{t.source?` (${t.source})`:''}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid cols-2" style={{marginTop:12}}>
        {SUBJECTS.map(s => (
          <div key={s.code} className="card" style={{margin:0}}>
            <div className="flex" style={{justifyContent:'space-between', marginBottom:8}}>
              <strong>{s.label}</strong><span style={{opacity:.6}}>{s.code}</span>
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
          <strong>Toplam:</strong> Doğru {totals.correct_total} • Yanlış {totals.wrong_total} • Boş {totals.blank_total} • Net (yaklaşık): {totals.net_total.toFixed(2)}
        </div>
        <button className="btn primary" onClick={submit} disabled={submitting}>{submitting ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </div>
      {error && <div style={{color:'#b91c1c', marginTop:8}}>{error}</div>}
    </div>
  )
}
