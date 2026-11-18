import { newApp, log, parseJson } from './core'
import { validate, listParams, like, HttpError, bad } from './util'

export const rooms = newApp()

const catSpec = {
  name: { t: 'str', req: true, max: 80 }, description: { t: 'str', max: 1000 }, base_price: { t: 'num', req: true, min: 0 },
  capacity: { t: 'int', req: true, min: 1 }, amenities: { t: 'json' }, image: { t: 'str', max: 300 },
} as const
const roomSpec = {
  number: { t: 'str', req: true, max: 20 }, floor: { t: 'int', req: true, min: 0 }, category_id: { t: 'int', req: true },
  price: { t: 'num', req: true, min: 0 }, capacity: { t: 'int', req: true, min: 1 }, amenities: { t: 'json' },
  status: { t: 'str', oneOf: ['available', 'occupied', 'maintenance'] },
  housekeeping_status: { t: 'str', oneOf: ['clean', 'dirty', 'cleaning', 'inspected'] },
  image: { t: 'str', max: 300 }, notes: { t: 'str', max: 1000 },
} as const

const fmtRoom = (r: any) => ({ ...r, amenities: parseJson(r.amenities) })

// ---- categories
rooms.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM rooms r WHERE r.category_id=c.id) AS room_count FROM room_categories c ORDER BY base_price`).all()
  return c.json(results.map((r: any) => ({ ...r, amenities: parseJson(r.amenities) })))
})
rooms.post('/categories', async (c) => {
  const v = validate(await c.req.json(), catSpec)
  const r = await c.env.DB.prepare('INSERT INTO room_categories (name,description,base_price,capacity,amenities,image) VALUES (?,?,?,?,?,?)')
    .bind(v.name, v.description ?? '', v.base_price, v.capacity, v.amenities ?? '[]', v.image ?? null).run()
  await log(c.env.DB, c.get('user'), 'create', 'category', r.meta.last_row_id, `Created room category ${v.name}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
rooms.put('/categories/:id', async (c) => {
  const id = +c.req.param('id'); const v = validate(await c.req.json(), catSpec, true)
  const keys = Object.keys(v); if (!keys.length) throw bad('Nothing to update')
  await c.env.DB.prepare(`UPDATE room_categories SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => v[k]), id).run()
  await log(c.env.DB, c.get('user'), 'update', 'category', id, `Updated room category #${id}`)
  return c.json({ ok: true })
})
rooms.delete('/categories/:id', async (c) => {
  const id = +c.req.param('id')
  const n = await c.env.DB.prepare('SELECT COUNT(*) n FROM rooms WHERE category_id=?').bind(id).first<{ n: number }>()
  if (n!.n > 0) throw bad('Category still has rooms. Move or delete them first.')
  await c.env.DB.prepare('DELETE FROM room_categories WHERE id=?').bind(id).run()
  await log(c.env.DB, c.get('user'), 'delete', 'category', id, `Deleted room category #${id}`)
  return c.json({ ok: true })
})

// ---- rooms
const BASE = `SELECT r.*, c.name AS category_name,
  (SELECT g.name FROM reservations x JOIN guests g ON g.id=x.guest_id WHERE x.room_id=r.id AND x.status='checked_in' LIMIT 1) AS current_guest,
  (SELECT x.check_out FROM reservations x WHERE x.room_id=r.id AND x.status='checked_in' LIMIT 1) AS current_checkout
  FROM rooms r JOIN room_categories c ON c.id=r.category_id`

rooms.get('/rooms', async (c) => {
  const q = c.req.query()
  const p = listParams(q, ['number', 'floor', 'price', 'capacity', 'status', 'housekeeping_status', 'category_name'], 'number')
  const where: string[] = []; const args: any[] = []
  if (q.q) { where.push('(r.number LIKE ? OR c.name LIKE ? OR r.notes LIKE ?)'); args.push(like(q.q), like(q.q), like(q.q)) }
  if (q.status) { where.push('r.status=?'); args.push(q.status) }
  if (q.housekeeping_status) { where.push('r.housekeeping_status=?'); args.push(q.housekeeping_status) }
  if (q.category_id) { where.push('r.category_id=?'); args.push(+q.category_id) }
  if (q.floor) { where.push('r.floor=?'); args.push(+q.floor) }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : ''
  // availability for a date range
  let avail = ''
  if (q.available_from && q.available_to) {
    avail = (w ? ' AND' : ' WHERE') + ` r.status!='maintenance' AND r.id NOT IN (SELECT room_id FROM reservations WHERE status IN ('confirmed','checked_in') AND check_in < ? AND check_out > ?)`
    args.push(q.available_to, q.available_from)
  }
  const sortCol = p.sort === 'category_name' ? 'c.name' : p.sort === 'number' ? 'CAST(r.number AS INTEGER)' : 'r.' + p.sort
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM rooms r JOIN room_categories c ON c.id=r.category_id${w}${avail}`).bind(...args).first<{ n: number }>()
  const { results } = await c.env.DB.prepare(`${BASE}${w}${avail} ORDER BY ${sortCol} ${q.dir === 'desc' ? 'DESC' : 'ASC'} LIMIT ? OFFSET ?`).bind(...args, p.pageSize, p.offset).all()
  return c.json({ data: results.map(fmtRoom), total: total!.n, page: p.page, pageSize: p.pageSize })
})
rooms.get('/rooms/:id', async (c) => {
  const id = +c.req.param('id')
  const r = await c.env.DB.prepare(`${BASE} WHERE r.id=?`).bind(id).first()
  if (!r) throw new HttpError(404, 'Room not found')
  const { results: upcoming } = await c.env.DB.prepare(
    `SELECT x.id,x.code,x.check_in,x.check_out,x.status,g.name guest_name FROM reservations x JOIN guests g ON g.id=x.guest_id
     WHERE x.room_id=? AND x.status IN ('confirmed','checked_in') ORDER BY x.check_in LIMIT 10`).bind(id).all()
  return c.json({ ...fmtRoom(r), upcoming })
})
rooms.post('/rooms', async (c) => {
  const v = validate(await c.req.json(), roomSpec)
  const dup = await c.env.DB.prepare('SELECT id FROM rooms WHERE number=?').bind(v.number).first()
  if (dup) throw bad('Validation failed', { number: 'Room number already exists' })
  const r = await c.env.DB.prepare('INSERT INTO rooms (number,floor,category_id,price,capacity,amenities,status,housekeeping_status,image,notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(v.number, v.floor, v.category_id, v.price, v.capacity, v.amenities ?? '[]', v.status ?? 'available', v.housekeeping_status ?? 'clean', v.image ?? null, v.notes ?? '').run()
  await log(c.env.DB, c.get('user'), 'create', 'room', r.meta.last_row_id, `Added room ${v.number}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
rooms.put('/rooms/:id', async (c) => {
  const id = +c.req.param('id'); const v = validate(await c.req.json(), roomSpec, true)
  if (v.number) {
    const dup = await c.env.DB.prepare('SELECT id FROM rooms WHERE number=? AND id!=?').bind(v.number, id).first()
    if (dup) throw bad('Validation failed', { number: 'Room number already exists' })
  }
  if (v.status === 'available' || v.status === 'maintenance') {
    const occ = await c.env.DB.prepare(`SELECT id FROM reservations WHERE room_id=? AND status='checked_in'`).bind(id).first()
    if (occ) throw bad('Room has a guest checked in. Check the guest out first.')
  }
  const keys = Object.keys(v); if (!keys.length) throw bad('Nothing to update')
  await c.env.DB.prepare(`UPDATE rooms SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => v[k]), id).run()
  await log(c.env.DB, c.get('user'), 'update', 'room', id, `Updated room #${id}`)
  return c.json({ ok: true })
})
rooms.delete('/rooms/:id', async (c) => {
  const id = +c.req.param('id')
  const n = await c.env.DB.prepare('SELECT COUNT(*) n FROM reservations WHERE room_id=?').bind(id).first<{ n: number }>()
  if (n!.n > 0) throw bad('Room has reservation history and cannot be deleted. Set it to maintenance instead.')
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM housekeeping_tasks WHERE room_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM maintenance_requests WHERE room_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM rooms WHERE id=?').bind(id),
  ])
  await log(c.env.DB, c.get('user'), 'delete', 'room', id, `Deleted room #${id}`)
  return c.json({ ok: true })
})
