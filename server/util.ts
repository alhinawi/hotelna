export type Env = { DB: D1Database; JWT_SECRET?: string }
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message) }
}
export const bad = (msg: string, details?: unknown) => new HttpError(400, msg, details)

type Spec = Record<string, { t: 'str' | 'num' | 'int' | 'bool' | 'date' | 'json' | 'email'; req?: boolean; max?: number; min?: number; oneOf?: readonly string[] }>

/** Validate a body against a spec. `partial` skips required checks (PATCH). Returns only known fields. */
export function validate(input: any, spec: Spec, partial = false) {
  if (!input || typeof input !== 'object') throw bad('Invalid body')
  const out: Record<string, any> = {}
  const errors: Record<string, string> = {}
  for (const [k, s] of Object.entries(spec)) {
    let v = input[k]
    if (v === undefined || v === null || v === '') {
      if (s.req && !partial) errors[k] = 'Required'
      else if (v === null || v === '') { if (!s.req) out[k] = s.t === 'bool' ? 0 : null }
      continue
    }
    switch (s.t) {
      case 'str': v = String(v).trim(); if (v.length > (s.max ?? 500)) errors[k] = 'Too long'; break
      case 'email': v = String(v).trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) errors[k] = 'Invalid email'; break
      case 'num': v = Number(v); if (!Number.isFinite(v)) errors[k] = 'Must be a number'; else if (s.min !== undefined && v < s.min) errors[k] = `Min ${s.min}`; break
      case 'int': v = Number(v); if (!Number.isInteger(v)) errors[k] = 'Must be an integer'; else if (s.min !== undefined && v < s.min) errors[k] = `Min ${s.min}`; break
      case 'bool': v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0; break
      case 'date': v = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) errors[k] = 'Invalid date'; break
      case 'json': v = typeof v === 'string' ? v : JSON.stringify(v); break
    }
    if (s.oneOf && !s.oneOf.includes(String(v))) errors[k] = `Must be one of: ${s.oneOf.join(', ')}`
    out[k] = v
  }
  if (Object.keys(errors).length) throw bad('Validation failed', errors)
  return out
}

export const todayStr = (tz = 'Africa/Cairo') => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const nowStr = () => new Date().toISOString().replace('T', ' ').slice(0, 19)
export const addDays = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
export const diffDays = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
export const round2 = (n: number) => Math.round(n * 100) / 100

export function listParams(q: Record<string, string>, sortable: string[], defSort: string) {
  const page = Math.max(1, parseInt(q.page || '1') || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(q.pageSize || '20') || 20))
  const sort = sortable.includes(q.sort) ? q.sort : defSort
  const dir = q.dir === 'asc' ? 'ASC' : q.dir === 'desc' ? 'DESC' : 'DESC'
  return { page, pageSize, sort, dir, offset: (page - 1) * pageSize }
}
export const like = (s: string) => `%${s.replace(/[%_]/g, '')}%`
