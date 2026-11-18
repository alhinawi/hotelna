import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, bus, getToken, setToken } from './api'
import { can as canFn, type Module } from '../../shared/perms'
import { useI18n } from './i18n'

export type User = { id: number; name: string; email: string; role: string; avatar?: string | null }
type Ctx = { user: User | null; ready: boolean; settings: Record<string, any>; reloadSettings: () => void; login: (e: string, p: string) => Promise<void>; logout: () => void; can: (m: Module, l?: 'read' | 'write') => boolean }
const AuthCtx = createContext<Ctx>(null as any)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Record<string, any>>({})
  const { setCurrency } = useI18n()
  const reloadSettings = useCallback(() => { api('/settings').then((s) => { setSettings(s); if (s.currency) setCurrency(s.currency) }).catch(() => {}) }, [setCurrency])
  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api<{ user: User }>('/auth/me').then((r) => { setUser(r.user); reloadSettings() }).catch(() => setToken(null)).finally(() => setReady(true))
  }, [reloadSettings])
  useEffect(() => { const h = () => setUser(null); bus.addEventListener('unauth', h); return () => bus.removeEventListener('unauth', h) }, [])
  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } })
    setToken(r.token); setUser(r.user); reloadSettings()
  }
  const logout = () => { setToken(null); setUser(null) }
  const can = (m: Module, l: 'read' | 'write' = 'read') => !!user && canFn(user.role, m, l)
  return <AuthCtx.Provider value={{ user, ready, settings, reloadSettings, login, logout, can }}>{children}</AuthCtx.Provider>
}
