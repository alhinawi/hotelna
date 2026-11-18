import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './core'
import { HttpError } from './util'
import { verifyToken } from './auth'
import { can, type Module } from '../shared/perms'
import { publicApp, admin } from './admin'
import { rooms } from './rooms'
import { guests } from './guests'
import { reservations } from './reservations'
import { billing } from './billing'
import { housekeeping } from './housekeeping'
import { staff } from './staff'
import { reports } from './reports'
import { demo } from './demo'

export const app = new Hono<AppEnv>().basePath('/api')

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, details: err.details }, err.status as any)
  if (err instanceof SyntaxError) return c.json({ error: 'Invalid JSON body' }, 400)
  console.error(err)
  // free-plan limits (D1 daily reads, CPU) surface as exceptions: tell the user the service is busy instead of a generic error
  if (/D1|7500|quota|limit|exceeded|too many|overloaded|storage/i.test(String((err as Error)?.message))) return c.json({ error: 'Service is busy, try again in a little while' }, 503)
  return c.json({ error: 'Internal error' }, 500)
})
app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff'); c.header('Cache-Control', 'no-store')
})
app.get('/health', (c) => c.json({ ok: true }))
app.route('/', publicApp)

// auth + RBAC for everything below
app.use('*', async (c, next) => {
  const h = c.req.header('Authorization') || ''
  const tok = h.startsWith('Bearer ') ? h.slice(7) : ''
  const p = tok ? await verifyToken(tok, c.env.JWT_SECRET || 'dev-only-secret-change-me-in-production') : null
  if (!p) throw new HttpError(401, 'Sign in required')
  c.set('user', { id: p.id, name: p.name, email: p.email, role: p.role })
  const seg = c.req.path.replace(/^\/api\//, '').split('/')[0]
  const MAP: Record<string, Module | 'any' | 'admin_only'> = {
    rooms: 'rooms', categories: 'rooms', reservations: 'reservations', calendar: 'reservations', guests: 'guests', housekeeping: 'housekeeping', maintenance: 'housekeeping',
    invoices: 'billing', staff: 'staff', shifts: 'staff', attendance: 'staff', reviews: 'staff', reports: 'reports', dashboard: 'dashboard', activity: 'dashboard',
    settings: 'settings', users: 'admin_only', demo: 'admin_only', auth: 'any', lookup: 'any', changes: 'any',
  }
  const m = MAP[seg]
  if (!m) throw new HttpError(404, 'Not found')
  const write = c.req.method !== 'GET'
  if (m === 'admin_only') { if (p.role !== 'admin') throw new HttpError(403, 'Admins only') }
  else if (m !== 'any') {
    if (!can(p.role, m, write ? 'write' : 'read')) {
      // read-only users of settings still need GET /settings (hotel name, currency); everyone may read settings
      if (!(m === 'settings' && !write)) throw new HttpError(403, 'You do not have permission for this action')
    }
  }
  await next()
})
app.route('/', admin)
app.route('/', demo)
app.route('/', rooms)
app.route('/', guests)
app.route('/', reservations)
app.route('/', billing)
app.route('/', housekeeping)
app.route('/', staff)
app.route('/', reports)
