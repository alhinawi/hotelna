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
import Reservations from './pages/Reservations'
import Guests from './pages/Guests'
import Housekeeping from './pages/Housekeeping'
import Billing from './pages/Billing'
import Staff from './pages/Staff'
import { lazy } from 'react'
const Reports = lazy(() => import('./pages/Reports'))


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
          <Route path="reservations" element={<Guard module="reservations"><Reservations /></Guard>} />
          <Route path="guests" element={<Guard module="guests"><Guests /></Guard>} />
          <Route path="housekeeping" element={<Guard module="housekeeping"><Housekeeping /></Guard>} />
          <Route path="billing" element={<Guard module="billing"><Billing /></Guard>} />
          <Route path="staff" element={<Guard module="staff"><Staff /></Guard>} />
          <Route path="reports" element={<Guard module="reports"><Reports /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><I18nProvider><AuthProvider><ToastProvider><Routed /></ToastProvider></AuthProvider></I18nProvider></BrowserRouter></StrictMode>,
)
