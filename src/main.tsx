import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { I18nProvider } from './lib/i18n'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Loading, ToastProvider } from './components/ui'
import type { Module } from '../shared/perms'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Rooms from './pages/Rooms'


function Guard({ module, children }: { module: Module; children: React.ReactNode }) {
  const { can } = useAuth()
  return can(module) ? <>{children}</> : <Navigate to="/" replace />
}
function Routed() {
  const { user, ready } = useAuth()
  if (!ready) return <Loading />
  if (!user) return <Login />
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="rooms" element={<Guard module="rooms"><Rooms /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><I18nProvider><AuthProvider><ToastProvider><Routed /></ToastProvider></AuthProvider></I18nProvider></BrowserRouter></StrictMode>,
)
