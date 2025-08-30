import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export default function StudentTable({ items }:{ items:any[] }){
  const { t } = useTranslation()
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Ad Soyad</th>
          <th>{t('dashboard.grade')}</th>
          <th>{t('dashboard.class')}</th>
          <th>{t('dashboard.guardian_phone')}</th>
          <th>{t('dashboard.workbook_progress')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map(s => (
          <tr key={s.id}>
            <td>{s.full_name}</td>
            <td><span className="badge">{s.grade}</span></td>
            <td>{s.class_section}</td>
            <td>{s.guardian_phone || '-'}</td>
            <td>{s.workbook_progress ?? '—'}</td>
            <td><Link to={`/students/${s.id}`} className="btn">{t('dashboard.view')}</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
