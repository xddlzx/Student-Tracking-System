import React from 'react'

export default function GradeFilter({ value, onChange }:{ value:number|null, onChange:(v:number|null)=>void }){
  const grades = [5,6,7,8]
  return (
    <div className="flex">
      {grades.map(g => (
        <button key={g} className={`btn ${value===g ? 'primary' : ''}`} onClick={()=>onChange(value===g?null:g)}>{g}</button>
      ))}
    </div>
  )
}
