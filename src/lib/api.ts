import { tr, trAll } from './errors'
import { useCallback, useEffect, useRef, useState } from 'react'

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string>) { super(message) }
}
const KEY = 'hotelna_token'
export const getToken = () => localStorage.getItem(KEY)
export const setToken = (t: string | null) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY))
export const bus = new EventTarget()

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }).catch(() => { throw new ApiError(0, tr('Network error')) })
  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login')) { setToken(null); bus.dispatchEvent(new Event('unauth')) }
    throw new ApiError(res.status, tr(data.error || 'Request failed'), trAll(data.details))
  }
  return data as T
}
export const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString(); return s ? '?' + s : ''
}

/** GET with auto-reload when anything changes in the hotel (polled by the layout) */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  const load = useCallback(async (silent = false) => {
    if (path === null) return
    const n = ++seq.current
    if (!silent) setLoading(true)
    try { const d = await api<T>(path); if (n === seq.current) { setData(d); setError(null) } }
    catch (e) { if (n === seq.current) setError(e as ApiError) }
    finally { if (n === seq.current) setLoading(false) }
  }, [path])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = () => load(true)
    bus.addEventListener('changed', h)
    return () => bus.removeEventListener('changed', h)
  }, [load])
  return { data, error, loading, reload: () => load(true) }
}
