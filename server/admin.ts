import { newApp, log, getSettings } from './core'
import { validate, HttpError, bad, todayStr, addDays, diffDays, round2 } from './util'
import { hashPassword, verifyPassword, signToken } from './auth'
import { ROLES, PERMS } from '../shared/perms'
import { INV_SELECT, computeInvoice } from './billing'

export const publicApp = newApp()
export const admin = newApp()

const secret = (c: any) => c.env.JWT_SECRET || 'dev-only-secret-change-me-in-production'

publicApp.post('/auth/login', async (c) => {
  const v = validate(await c.req.json(), { email: { t: 'email', req: true }, password: { t: 'str', req: true, max: 200 } })
  const u = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(v.email).first<any>()
  const ok = u && u.active && (await verifyPassword(v.password, u.password_hash))
  if (!ok) throw new HttpError(401, 'Wrong email or password')
  const token = await signToken({ id: u.id, name: u.name, email: u.email, role: u.role }, secret(c))
  await log(c.env.DB, { id: u.id, name: u.name, email: u.email, role: u.role }, 'login', 'user', u.id, `${u.name} signed in`)
  return c.json({ token, user: { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar } })
})

// ---- me / password
admin.get('/auth/me', async (c) => {
  const u = c.get('user')
  const row = await c.env.DB.prepare('SELECT id,name,email,role,avatar,active FROM users WHERE id=?').bind(u.id).first<any>()
  if (!row || !row.active) throw new HttpError(401, 'Account disabled')
  return c.json({ user: row, permissions: (PERMS as any)[row.role] })
})
admin.post('/auth/password', async (c) => {
  const u = c.get('user')
  const v = validate(await c.req.json(), { current: { t: 'str', req: true }, next: { t: 'str', req: true, min: 8, max: 200 } })
  if (v.next.length < 8) throw bad('Validation failed', { next: 'At least 8 characters' })
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(u.id).first<any>()
  if (!(await verifyPassword(v.current, row.password_hash))) throw bad('Validation failed', { current: 'Wrong password' })
  await c.env.DB.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await hashPassword(v.next), u.id).run()
  return c.json({ ok: true })
})
admin.get('/lookup', async (c) => {
  const db = c.env.DB
  const [st, gs, rm, ct] = await Promise.all([
    db.prepare(`SELECT id,name,department FROM staff WHERE status='active' ORDER BY name`).all(),
    db.prepare('SELECT id,name,phone,vip FROM guests ORDER BY name LIMIT 500').all(),
    db.prepare(`SELECT r.id,r.number,r.floor,r.price,r.capacity,r.status,c.name category_name FROM rooms r JOIN room_categories c ON c.id=r.category_id ORDER BY CAST(r.number AS INTEGER)`).all(),
    db.prepare('SELECT id,name FROM room_categories ORDER BY base_price').all(),
  ])
  return c.json({ staff: st.results, guests: gs.results, rooms: rm.results, categories: ct.results })
})
admin.get('/changes', async (c) => {
  const r = await c.env.DB.prepare('SELECT COALESCE(MAX(id),0) id FROM activity_log').first<{ id: number }>()
  return c.json({ last: r!.id })
})
admin.get('/activity', async (c) => {
  const limit = Math.min(100, +(c.req.query('limit') || 20))
  const { results } = await c.env.DB.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?').bind(limit).all()
  return c.json(results)
})

// ---- settings
admin.get('/settings', async (c) => c.json(await getSettings(c.env.DB)))
admin.put('/settings', async (c) => {
  const body = await c.req.json()
  if (!body || typeof body !== 'object') throw bad('Invalid body')
  const allowed = ['hotel_name', 'hotel_address', 'hotel_phone', 'hotel_email', 'hotel_logo', 'checkin_time', 'checkout_time', 'currency', 'currency_symbol', 'tax_rate', 'service_rate', 'weekend_markup', 'default_language', 'timezone', 'star_rating']
  const stmts = []
  for (const [k, val] of Object.entries(body)) {
    if (!allowed.includes(k)) continue
    if (['tax_rate', 'service_rate', 'weekend_markup'].includes(k) && (!Number.isFinite(+(val as any)) || +(val as any) < 0 || +(val as any) > 100)) throw bad('Validation failed', { [k]: 'Must be between 0 and 100' })
    stmts.push(c.env.DB.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k, JSON.stringify(typeof val === 'string' && ['tax_rate', 'service_rate', 'weekend_markup'].includes(k) ? +val : val)))
  }
  if (stmts.length) await c.env.DB.batch(stmts)
  await log(c.env.DB, c.get('user'), 'update', 'settings', null, 'Updated hotel settings')
  return c.json({ ok: true })
})

// ---- users & roles (admin only, enforced in index)
const userSpec = { name: { t: 'str', req: true, max: 100 }, email: { t: 'email', req: true }, role: { t: 'str', req: true, oneOf: ROLES }, active: { t: 'bool' }, staff_id: { t: 'int' } } as const
admin.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id,name,email,role,active,staff_id,created_at FROM users ORDER BY id').all()
  return c.json({ users: results, roles: ROLES, permissions: PERMS })
})
admin.post('/users', async (c) => {
  const b = await c.req.json()
  const v = validate(b, userSpec)
  if (typeof b.password !== 'string' || b.password.length < 8) throw bad('Validation failed', { password: 'At least 8 characters' })
  const dup = await c.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(v.email).first()
  if (dup) throw bad('Validation failed', { email: 'Email already in use' })
  const r = await c.env.DB.prepare('INSERT INTO users (name,email,password_hash,role,staff_id,active) VALUES (?,?,?,?,?,?)').bind(v.name, v.email, await hashPassword(b.password), v.role, v.staff_id ?? null, v.active ?? 1).run()
  await log(c.env.DB, c.get('user'), 'create', 'user', r.meta.last_row_id, `Created user ${v.email} (${v.role})`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
admin.put('/users/:id', async (c) => {
  const id = +c.req.param('id'); const b = await c.req.json(); const me = c.get('user')
  const v = validate(b, userSpec, true)
  if (id === me.id && (v.role && v.role !== 'admin' || v.active === 0)) throw bad('You cannot demote or disable your own account')
  if (v.email) { const dup = await c.env.DB.prepare('SELECT id FROM users WHERE email=? AND id!=?').bind(v.email, id).first(); if (dup) throw bad('Validation failed', { email: 'Email already in use' }) }
  const all: Record<string, any> = { ...v }
  if (b.password) { if (String(b.password).length < 8) throw bad('Validation failed', { password: 'At least 8 characters' }); all.password_hash = await hashPassword(String(b.password)) }
  const keys = Object.keys(all); if (!keys.length) throw bad('Nothing to update')
  await c.env.DB.prepare(`UPDATE users SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => all[k]), id).run()
  await log(c.env.DB, me, 'update', 'user', id, `Updated user #${id}`)
  return c.json({ ok: true })
})
admin.delete('/users/:id', async (c) => {
  const id = +c.req.param('id')
  if (id === c.get('user').id) throw bad('You cannot delete your own account')
  await c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(id).run()
  await log(c.env.DB, c.get('user'), 'delete', 'user', id, `Deleted user #${id}`)
  return c.json({ ok: true })
})

// ---- dashboard
admin.get('/dashboard', async (c) => {
  const db = c.env.DB; const today = todayStr(); const monthStart = today.slice(0, 7) + '-01'
  const one = async (sql: string, ...a: any[]) => (await db.prepare(sql).bind(...a).first<any>()) ?? {}
  const [rc, arr, dep, revToday, revMonth, stay, outst] = await Promise.all([
    one(`SELECT COUNT(*) total, SUM(status='occupied') occupied, SUM(status='available') vacant, SUM(status='maintenance') maintenance,
         SUM(housekeeping_status='dirty') dirty FROM rooms`),
    one(`SELECT COUNT(*) n, SUM(status='checked_in') done FROM reservations WHERE check_in=? AND status IN ('confirmed','checked_in','checked_out')`, today),
    one(`SELECT COUNT(*) n, SUM(status='checked_out') done FROM reservations WHERE check_out=? AND status IN ('checked_in','checked_out')`, today),
    one(`SELECT COALESCE(SUM(CASE WHEN kind='payment' THEN amount ELSE -amount END),0) v FROM payments WHERE date(created_at)=?`, today),
    one(`SELECT COALESCE(SUM(CASE WHEN kind='payment' THEN amount ELSE -amount END),0) v FROM payments WHERE date(created_at)>=?`, monthStart),
    one(`SELECT COUNT(*) n FROM reservations WHERE status='checked_in'`),
    db.prepare(`${INV_SELECT} WHERE i.status!='void'`).all(),
  ])
  const outstanding = round2((outst.results as any[]).map(computeInvoice).reduce((a, i) => a + Math.max(0, i.balance), 0))
  const from14 = addDays(today, -13)
  const { results: daily } = await db.prepare(`SELECT date(created_at) d, SUM(CASE WHEN kind='payment' THEN amount ELSE -amount END) v FROM payments WHERE date(created_at)>=? GROUP BY d`).bind(from14).all<any>()
  const dm = new Map(daily.map((r: any) => [r.d, r.v]))
  const revenue14 = Array.from({ length: 14 }, (_, i) => { const d = addDays(from14, i); return { date: d, revenue: round2(Number(dm.get(d) ?? 0)) } })
  const { results: byStatus } = await db.prepare(`SELECT status, COUNT(*) n FROM reservations WHERE date(created_at)>=? OR check_out>=? GROUP BY status`).bind(addDays(today, -30), addDays(today, -30)).all()
  const { results: bySource } = await db.prepare(`SELECT source, COUNT(*) n FROM reservations WHERE status!='cancelled' GROUP BY source ORDER BY n DESC`).all()
  const next7 = await one(`SELECT COUNT(*) n FROM reservations WHERE status='confirmed' AND check_in>? AND check_in<=?`, today, addDays(today, 7))
  const { results: recent } = await db.prepare(`SELECT x.id,x.code,x.status,x.check_in,x.check_out,x.total,x.created_at,g.name guest_name,g.vip guest_vip,rm.number room_number FROM reservations x JOIN guests g ON g.id=x.guest_id JOIN rooms rm ON rm.id=x.room_id ORDER BY x.created_at DESC, x.id DESC LIMIT 8`).all()
  const { results: activity } = await db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT 12').all()
  const { results: arrivals } = await db.prepare(`SELECT x.id,x.code,x.status,g.name guest_name,g.vip guest_vip,rm.number room_number FROM reservations x JOIN guests g ON g.id=x.guest_id JOIN rooms rm ON rm.id=x.room_id WHERE x.check_in=? AND x.status IN ('confirmed','checked_in') ORDER BY rm.number LIMIT 6`).bind(today).all()
  const { results: departures } = await db.prepare(`SELECT x.id,x.code,x.status,g.name guest_name,g.vip guest_vip,rm.number room_number FROM reservations x JOIN guests g ON g.id=x.guest_id JOIN rooms rm ON rm.id=x.room_id WHERE x.check_out=? AND x.status IN ('checked_in','checked_out') ORDER BY rm.number LIMIT 6`).bind(today).all()
  const { results: occ7 } = await db.prepare(`SELECT check_in,check_out FROM reservations WHERE status IN ('confirmed','checked_in','checked_out') AND check_in<=? AND check_out>?`).bind(addDays(today, 6), addDays(today, -7)).all<any>()
  const occupancyTrend = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 7)
    const n = occ7.filter((r: any) => r.check_in <= d && r.check_out > d).length
    return { date: d, occupancy: rc.total ? Math.round((n / (rc.total - 0)) * 100) : 0 }
  })
  return c.json({
    rooms: { total: rc.total, occupied: rc.occupied ?? 0, vacant: rc.vacant ?? 0, maintenance: rc.maintenance ?? 0, dirty: rc.dirty ?? 0 },
    occupancy_rate: rc.total ? Math.round(((rc.occupied ?? 0) / rc.total) * 100) : 0,
    checkins: { total: arr.n ?? 0, done: arr.done ?? 0 }, checkouts: { total: dep.n ?? 0, done: dep.done ?? 0 },
    in_house: stay.n ?? 0, upcoming_7d: next7.n ?? 0,
    revenue: { today: round2(revToday.v), month: round2(revMonth.v), outstanding }, revenue14, occupancyTrend,
    bookings: { byStatus, bySource }, recent, activity, arrivals, departures,
  })
})
