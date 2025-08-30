import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles.css'
import './i18n'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import StudentDetailPage from './pages/StudentDetailPage'
import Teachers from './pages/rooter/Teachers'
import NewTeacher from './pages/rooter/NewTeacher'
import NewStudent from './pages/rooter/NewStudent'
import TeacherDetail from './pages/rooter/TeacherDetail'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/students/:id" element={<StudentDetailPage />} />
        <Route path="/rooter/teachers" element={<Teachers />} />
        <Route path="/rooter/teachers/new" element={<NewTeacher />} />
        <Route path="/rooter/teachers/:id" element={<TeacherDetail />} />
        <Route path="/rooter/students/new" element={<NewStudent />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
)
