import { newApp, log } from './core'
import { validate, listParams, like, HttpError, bad } from './util'

export const guests = newApp()
const spec = {
  name: { t: 'str', req: true, max: 120 }, email: { t: 'email' }, phone: { t: 'str', max: 40 }, nationality: { t: 'str', max: 60 },
  id_type: { t: 'str', oneOf: ['passport', 'national_id', 'driver_license', 'residence_permit'] }, id_number: { t: 'str', max: 60 },
  id_document: { t: 'str', max: 400000 }, address: { t: 'str', max: 300 }, vip: { t: 'bool' }, preferences: { t: 'str', max: 1000 }, notes: { t: 'str', max: 2000 },
} as const

guests.get('/guests', async (c) => {
  const q = c.req.query()
  const p = listParams(q, ['name', 'nationality', 'created_at', 'stays', 'last_stay', 'total_spent'], 'name')
  const where: string[] = []; const args: any[] = []
  if (q.q) { where.push('(g.name LIKE ? OR g.email LIKE ? OR g.phone LIKE ? OR g.id_number LIKE ?)'); args.push(like(q.q), like(q.q), like(q.q), like(q.q)) }
  if (q.vip === '1') where.push('g.vip=1')
  const w = where.length ? ' WHERE ' + where.join(' AND ') : ''
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM guests g${w}`).bind(...args).first<{ n: number }>()
  const { results } = await c.env.DB.prepare(
    `SELECT g.id,g.name,g.email,g.phone,g.nationality,g.vip,g.created_at, g.id_type, g.id_number,
      (SELECT COUNT(*) FROM reservations r WHERE r.guest_id=g.id AND r.status IN ('checked_in','checked_out')) AS stays,
      (SELECT MAX(check_out) FROM reservations r WHERE r.guest_id=g.id AND r.status='checked_out') AS last_stay,
      (SELECT COALESCE(SUM(CASE WHEN p.kind='payment' THEN p.amount ELSE -p.amount END),0) FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.guest_id=g.id) AS total_spent
     FROM guests g${w} ORDER BY ${p.sort} ${q.dir === 'desc' ? 'DESC' : 'ASC'} LIMIT ? OFFSET ?`).bind(...args, p.pageSize, p.offset).all()
  return c.json({ data: results, total: total!.n, page: p.page, pageSize: p.pageSize })
})
guests.get('/guests/:id', async (c) => {
  const id = +c.req.param('id')
  const g = await c.env.DB.prepare('SELECT * FROM guests WHERE id=?').bind(id).first()
  if (!g) throw new HttpError(404, 'Guest not found')
  const { results: stays } = await c.env.DB.prepare(
    `SELECT r.id,r.code,r.check_in,r.check_out,r.status,r.total,r.nights,rm.number room_number,c.name category_name
     FROM reservations r JOIN rooms rm ON rm.id=r.room_id JOIN room_categories c ON c.id=rm.category_id WHERE r.guest_id=? ORDER BY r.check_in DESC`).bind(id).all()
  const spent = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN p.kind='payment' THEN p.amount ELSE -p.amount END),0) s FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.guest_id=?`).bind(id).first<{ s: number }>()
  return c.json({ ...g, stays, total_spent: spent!.s })
})
guests.post('/guests', async (c) => {
  const v = validate(await c.req.json(), spec)
  const r = await c.env.DB.prepare('INSERT INTO guests (name,email,phone,nationality,id_type,id_number,id_document,address,vip,preferences,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(v.name, v.email ?? null, v.phone ?? null, v.nationality ?? null, v.id_type ?? 'passport', v.id_number ?? null, v.id_document ?? null, v.address ?? null, v.vip ?? 0, v.preferences ?? '', v.notes ?? '').run()
  await log(c.env.DB, c.get('user'), 'create', 'guest', r.meta.last_row_id, `Added guest ${v.name}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
guests.put('/guests/:id', async (c) => {
  const id = +c.req.param('id'); const v = validate(await c.req.json(), spec, true)
  const keys = Object.keys(v); if (!keys.length) throw bad('Nothing to update')
  await c.env.DB.prepare(`UPDATE guests SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => v[k]), id).run()
  await log(c.env.DB, c.get('user'), 'update', 'guest', id, `Updated guest #${id}`)
  return c.json({ ok: true })
})
guests.delete('/guests/:id', async (c) => {
  const id = +c.req.param('id')
  const n = await c.env.DB.prepare('SELECT COUNT(*) n FROM reservations WHERE guest_id=?').bind(id).first<{ n: number }>()
  if (n!.n > 0) throw bad('Guest has reservations and cannot be deleted.')
  await c.env.DB.prepare('DELETE FROM guests WHERE id=?').bind(id).run()
  await log(c.env.DB, c.get('user'), 'delete', 'guest', id, `Deleted guest #${id}`)
  return c.json({ ok: true })
})
