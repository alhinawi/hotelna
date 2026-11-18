'use client'
import { Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import { AuthProvider, useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { Loading, ToastProvider } from './components/ui'
import type { Module } from '../shared/perms'
import Login from './views/Login'
import Dashboard from './views/Dashboard'
import Rooms from './views/Rooms'
import Reservations from './views/Reservations'
import Guests from './views/Guests'
import Housekeeping from './views/Housekeeping'
import Billing from './views/Billing'
import Staff from './views/Staff'
import Settings from './views/Settings'
import { lazy } from 'react'
const Reports = lazy(() => import('./views/Reports'))


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
          <Route path="settings" element={<Guard module="settings"><Settings /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
export default function App() {
  return <BrowserRouter><I18nProvider><AuthProvider><ToastProvider><Routed /></ToastProvider></AuthProvider></I18nProvider></BrowserRouter>
}
