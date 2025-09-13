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

const LABELS: Record<string, string> = { TR: 'Türkçe', MAT: 'Mat', FEN: 'Fen', INK: 'İnk', ING: 'İng', DIN: 'Din' }
const SUBJECT_COLORS: Record<string, string> = {
  TR: '#6366F1', // Türkçe
  MAT: '#10B981', // Mat
  FEN: '#F59E0B', // Fen
  INK: '#EF4444', // İnk
  ING: '#3B82F6', // İng
  DIN: '#8B5CF6', // Din
}

export default function TrialHistory({ student, refreshToken = 0 }: { student: any; refreshToken?: number }) {
  const [items, setItems] = useState<TrialResult[]>([])
  const [trials, setTrials] = useState<Record<string, TrialExam>>({})
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

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
          ; (arr || []).forEach(t => { m[t.id] = t })
        if (!cancelled) setTrials(m)
      } catch {
        if (!cancelled) setTrials({})
      }
    }

    load()
    return () => { cancelled = true }
  }, [student?.id, student?.grade, refreshToken])

  // Merge + sort by exam date (fallback to entered_at), chronological ASC (oldest → newest)
  const displayItems = useMemo(() => {
    const getDate = (r: TrialResult) =>
      (trials[r.trial_exam_id]?.date || r.entered_at || '').slice(0, 10)
    return [...items].sort((a, b) =>
      new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime()
    )
  }, [items, trials])

  const lineData = useMemo(() => {
    return displayItems.map(r => {
      const ex = trials[r.trial_exam_id]
      const x = ex ? (ex.date || '').slice(0, 10) : (r.entered_at || '').slice(0, 10)
      return { name: ex ? ex.name : x, net: Number(r.net_total) }
    })
  }, [displayItems, trials])

  const subjectSeries = useMemo(() => {
    return displayItems.map(r => {
      const ex = trials[r.trial_exam_id]
      const row: any = { name: ex ? ex.name : (r.entered_at || '').slice(0, 10) }
        ; (r.subjects || []).forEach(s => { row[s.subject_code] = s.net })
      return row
    })
  }, [displayItems, trials])

  async function deleteAttempt(id: string) {
    // Optimistic UI: remove from UI immediately, revert on failure
    setDeletingIds(prev => new Set(prev).add(id))
    const prevItems = items
    setItems(curr => curr.filter(x => x.id !== id))
    try {
      await api(`/trial-results/${encodeURIComponent(id)}`, { method: 'DELETE' })
      // success → nothing else (charts & list already reflect state)
    } catch (err: any) {
      // revert on error
      setItems(prevItems)
      let msg = 'Silme başarısız.'
      if (err?.message) msg += ` ${err.message}`
      alert(msg)
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="card">
      <h3>Deneme Geçmişi</h3>
      {displayItems.length === 0 ? (
        <div>Henüz kayıt yok.</div>
      ) : (
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
                <Bar dataKey="TR" name={LABELS.TR} fill={SUBJECT_COLORS.TR} />
                <Bar dataKey="MAT" name={LABELS.MAT} fill={SUBJECT_COLORS.MAT} />
                <Bar dataKey="FEN" name={LABELS.FEN} fill={SUBJECT_COLORS.FEN} />
                <Bar dataKey="INK" name={LABELS.INK} fill={SUBJECT_COLORS.INK} />
                <Bar dataKey="ING" name={LABELS.ING} fill={SUBJECT_COLORS.ING} />
                <Bar dataKey="DIN" name={LABELS.DIN} fill={SUBJECT_COLORS.DIN} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* List view under the charts */}
      <div style={{ marginTop: 20 }}>
        <h4 style={{ marginBottom: 8 }}>Deneme Kayıtları</h4>

        <div style={{ display: 'grid', gap: 12 }}>
          {displayItems.map((r: any) => {
            const ex = trials[r.trial_exam_id]
            const d = (ex?.date || r.entered_at || '').slice(0, 10)
            const sub = r.subjects || []
            const deleting = deletingIds.has(r.id)

            return (
              <div
                key={r.id}
                className="card"
                style={{
                  padding: 12,
                  border: '1px solid #E5E7EB',
                  borderRadius: 12,
                  background: deleting ? '#FAFAFA' : '#FFFFFF',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {ex?.name ?? '—'}
                    <span style={{ opacity: 0.6, fontSize: 12, marginLeft: 8 }}>{d}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: '#F3F4F6',
                        border: '1px solid #E5E7EB',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Toplam Net: {Number(r.net_total).toFixed(2)}
                    </div>

                    <button
                      type="button"
                      aria-label="Denemeyi sil"
                      onClick={() => {
                        if (deleting) return
                        const ok = confirm('Bu deneme kaydını silmek istediğinize emin misiniz?')
                        if (ok) deleteAttempt(r.id)
                      }}
                      disabled={deleting}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #EF4444',
                        background: deleting ? '#FEE2E2' : '#FFF',
                        color: '#EF4444',
                        cursor: deleting ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      {deleting ? 'Siliniyor…' : 'Sil'}
                    </button>
                  </div>
                </div>

                {/* Subjects grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  {sub.map((s: any) => {
                    const color = SUBJECT_COLORS[s.subject_code] || '#6B7280' // fallback gray
                    return (
                      <div
                        key={s.subject_code}
                        style={{
                          border: `1px solid ${color}33`,   // ~20% alpha
                          borderRadius: 10,
                          padding: 10,
                          background: `${color}0D`,        // ~5% alpha
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 12,
                              color,
                            }}
                          >
                            {LABELS[s.subject_code] || s.subject_code}
                          </span>

                          <span
                            title="Net"
                            style={{
                              fontWeight: 800,
                              fontSize: 12,
                              color,
                            }}
                          >
                            {Number(s.net).toFixed(2)}
                          </span>
                        </div>

                        <div style={{ fontSize: 12, opacity: 0.85 }}>
                          Doğru {s.correct} • Yanlış {s.wrong} • Boş {s.blank}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
