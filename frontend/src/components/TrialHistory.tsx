import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts'

type TrialExam = { id: string; name: string; date: string }
type TrialSubject = { subject_code: string; correct: number; wrong: number; blank: number; net: number }
type TrialResult = {
  id: string;
  trial_exam_id: string;
  correct_total: number | string;
  wrong_total: number | string;
  blank_total: number | string;
  net_total: number | string;
  entered_at?: string;
  is_finalized?: boolean;
  subjects?: TrialSubject[];
}

const LABELS: Record<string,string> = { TR: 'Türkçe', MAT: 'Mat', FEN: 'Fen', INK: 'İnk', ING: 'İng', DIN: 'Din' }

export default function TrialHistory({ student, refreshToken = 0 }:{ student:any; refreshToken?: number }){
  const [items, setItems] = useState<TrialResult[]>([])
  const [trials, setTrials] = useState<Record<string, TrialExam>>({})

  useEffect(() => {
    if (!student?.id) return
    let cancelled = false

    async function load() {
      // ---- 1) Fetch student's trial results (with fallback route) ----
      try {
        const res = await api(`/students/${student.id}/trial-results`)
        const list: TrialResult[] = Array.isArray(res) ? res : (res?.items || [])
        if (!cancelled) setItems(list)
      } catch {
        try {
          const res = await api(`/trial-results?student_id=${encodeURIComponent(student.id)}`)
          const list: TrialResult[] = Array.isArray(res) ? res : (res?.items || [])
          if (!cancelled) setItems(list)
        } catch {
          if (!cancelled) setItems([])
        }
      }

      // ---- 2) Fetch exams meta (try by grade first, then fallback to all) ----
      try {
        let arr: TrialExam[] = []
        try {
          arr = await api(`/trials?grade=${encodeURIComponent(student.grade)}`)
        } catch {
          arr = await api(`/trials`)
        }
        const m: Record<string, TrialExam> = {}
        ;(arr || []).forEach(t => { m[t.id] = t })
        if (!cancelled) setTrials(m)
      } catch {
        if (!cancelled) setTrials({})
      }
    }

    load()
    return () => { cancelled = true }
  }, [student?.id, student?.grade, refreshToken])

  // Merge + sort by exam date (fallback to entered_at), newest first
  const displayItems = useMemo(() => {
    const getDate = (r: TrialResult) => {
      const d = trials[r.trial_exam_id]?.date || r.entered_at || ''
      return (d || '').slice(0, 10)
    }
    return [...items].sort((a, b) => new Date(getDate(b)).getTime() - new Date(getDate(a)).getTime())
  }, [items, trials])

  const lineData = useMemo(() => {
    return displayItems.map(r => {
      const ex = trials[r.trial_exam_id]
      const x = ex ? (ex.date || '').slice(0,10) : (r.entered_at || '').slice(0,10)
      return { name: ex ? ex.name : x, net: Number(r.net_total) }
    })
  }, [displayItems, trials])

  const subjectSeries = useMemo(() => {
    return displayItems.map(r => {
      const ex = trials[r.trial_exam_id]
      const row: any = { name: ex ? ex.name : (r.entered_at || '').slice(0,10) }
      ;(r.subjects || []).forEach(s => { row[s.subject_code] = s.net })
      return row
    })
  }, [displayItems, trials])

  return (
    <div className="card">
      <h3>Deneme Geçmişi</h3>
      {displayItems.length === 0 ? <div>Henüz kayıt yok.</div> : (
        <div className="grid cols-2">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="net" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="TR" name={LABELS.TR} />
                <Bar dataKey="MAT" name={LABELS.MAT} />
                <Bar dataKey="FEN" name={LABELS.FEN} />
                <Bar dataKey="INK" name={LABELS.INK} />
                <Bar dataKey="ING" name={LABELS.ING} />
                <Bar dataKey="DIN" name={LABELS.DIN} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
