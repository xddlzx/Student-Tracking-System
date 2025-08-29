import React from 'react'
export default function Tabs({tabs, active, onChange}:{tabs:string[], active:number, onChange:(i:number)=>void}){
  return (
    <div className="tabs">
      {tabs.map((t,i)=>(
        <div key={t} className={`tab ${active===i?'active':''}`} onClick={()=>onChange(i)}>{t}</div>
      ))}
    </div>
  )
}
