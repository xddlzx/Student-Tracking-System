
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'

export default function Teachers(){
  const [items, setItems] = useState<any[]>([])
  useEffect(()=>{
    api('/teachers').then((r:any)=>setItems(r.items||[])).catch(()=>{})
  }, [])
  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
          <h2 style={{margin:0}}>Öğretmenler</h2>
          <div>
            <Link className="btn" to="/rooter/teachers/new">Yeni Öğretmen</Link>
            <Link className="btn" to="/rooter/students/new" style={{marginLeft:8}}>Yeni Öğrenci</Link>
          </div>
        </div>
        <table className="table" style={{marginTop:12}}>
          <thead><tr><th>Ad Soyad</th><th>E‑posta</th><th>Kullanıcı Adı</th><th>İlk Girişte Şifre</th><th></th></tr></thead>
          <tbody>
            {items.map(t=>(
              <tr key={t.id}>
                <td>{t.full_name}</td>
                <td>{t.email}</td>
                <td>{t.username}</td>
                <td>{t.must_change_password ? 'Zorunlu' : '—'}</td>
                <td><Link className="btn" to={`/rooter/teachers/${t.id}`}>İncele</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
