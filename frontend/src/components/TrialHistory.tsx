
import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts'

type TrialExam = { id: string; name: string; date: string }
type TrialSubject = { subject_code: string; correct: number; wrong: number; blank: number; net: number }
type TrialResult = { id: string; trial_exam_id: string; correct_total: number; wrong_total: number; blank_total: number; net_total: number; entered_at?: string; subjects?: TrialSubject[] }

const LABELS: Record<string,string> = { TR: 'Türkçe', MAT: 'Mat', FEN: 'Fen', SOS: 'Sosyal', ING: 'İng', DIN: 'Din' }

export default function TrialHistory({ student }:{ student:any }){
  const [items, setItems] = useState<TrialResult[]>([])
  const [trials, setTrials] = useState<Record<string, TrialExam>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!student) return
    // Try to fetch student's trial history (preferred)
    api(`/students/${student.id}/trials`).then((res:any) => {
      setItems(res.items || res || [])
    }).catch(() => {
      // Fallback: empty history (backend ZIP may have this hidden)
      setItems([])
    })

    api(`/trials?grade=${student.grade}`).then((arr:TrialExam[]) => {
      const m:Record<string,TrialExam> = {}
      arr.forEach(t => m[t.id] = t)
      setTrials(m)
    }).catch(()=>{})
  }, [student?.id])

  const lineData = useMemo(() => {
    return items.map(r => {
      const ex = trials[r.trial_exam_id]
      const x = ex ? ex.date : r.entered_at?.slice(0,10) || ''
      return { x, net: Number(r.net_total) }
    }).sort((a,b)=> (a.x || '').localeCompare(b.x||''))
  }, [items, trials])

  const last = items[0]
  const barData = useMemo(() => {
    if (!last || !last.subjects) return []
    return last.subjects.map(s => ({ name: LABELS[s.subject_code] || s.subject_code, net: Number(s.net) }))
  }, [items])

  return (
    <div className="card">
      <h3>Deneme Geçmişi</h3>
      {items.length === 0 ? <div>Henüz kayıt yok.</div> : (
        <div className="grid cols-2">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="net" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="net" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
