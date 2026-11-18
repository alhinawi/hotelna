import { newApp, log, getSettings } from './core'
import { validate, listParams, like, HttpError, bad, nowStr, todayStr, diffDays, addDays, round2 } from './util'
import { createInvoiceFor, syncRoomCharge, INV_SELECT, computeInvoice } from './billing'

export const reservations = newApp()

const spec = {
  guest_id: { t: 'int', req: true }, room_id: { t: 'int', req: true }, check_in: { t: 'date', req: true }, check_out: { t: 'date', req: true },
  adults: { t: 'int', min: 1 }, children: { t: 'int', min: 0 }, source: { t: 'str', oneOf: ['direct', 'phone', 'website', 'booking_com', 'expedia', 'agency', 'walk_in'] },
  rate: { t: 'num', min: 0 }, notes: { t: 'str', max: 1000 }, walk_in: { t: 'bool' },
} as const

const SEL = `SELECT x.*, g.name AS guest_name, g.vip AS guest_vip, g.phone AS guest_phone, rm.number AS room_number, rm.floor AS room_floor, c.name AS category_name
  FROM reservations x JOIN guests g ON g.id=x.guest_id JOIN rooms rm ON rm.id=x.room_id JOIN room_categories c ON c.id=rm.category_id`

async function calcTotal(db: D1Database, rate: number, ci: string, co: string) {
  const s = await getSettings(db)
  const mk = Number(s.weekend_markup ?? 0) / 100
  let total = 0
  for (let d = ci; d < co; d = addDays(d, 1)) {
    const dow = new Date(d + 'T00:00:00Z').getUTCDay()
    total += rate * (dow === 5 || dow === 6 ? 1 + mk : 1)
  }
  return round2(total)
}
export async function conflicts(db: D1Database, roomId: number, ci: string, co: string, exceptId = 0) {
  return db.prepare(`SELECT x.code, g.name guest FROM reservations x JOIN guests g ON g.id=x.guest_id
    WHERE x.room_id=? AND x.id!=? AND x.status IN ('confirmed','checked_in') AND x.check_in < ? AND x.check_out > ? LIMIT 1`).bind(roomId, exceptId, co, ci).first<{ code: string; guest: string }>()
}
const mkCode = () => 'RS-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 4).toUpperCase()

reservations.get('/reservations', async (c) => {
  const q = c.req.query()
  const p = listParams(q, ['code', 'check_in', 'check_out', 'total', 'status', 'guest_name', 'room_number', 'created_at'], 'created_at')
  const where: string[] = []; const args: any[] = []
  if (q.q) { where.push('(x.code LIKE ? OR g.name LIKE ? OR rm.number LIKE ? OR g.phone LIKE ?)'); args.push(like(q.q), like(q.q), like(q.q), like(q.q)) }
  if (q.status) { where.push('x.status=?'); args.push(q.status) }
  if (q.guest_id) { where.push('x.guest_id=?'); args.push(+q.guest_id) }
  if (q.room_id) { where.push('x.room_id=?'); args.push(+q.room_id) }
  if (q.source) { where.push('x.source=?'); args.push(q.source) }
  if (q.from) { where.push('x.check_out >= ?'); args.push(q.from) }   // overlaps window [from,to)
  if (q.to) { where.push('x.check_in <= ?'); args.push(q.to) }
  if (q.arrivals) { where.push(`x.check_in=? AND x.status='confirmed'`); args.push(q.arrivals) }
  if (q.departures) { where.push(`x.check_out=? AND x.status='checked_in'`); args.push(q.departures) }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : ''
  const sortCol = p.sort === 'guest_name' ? 'g.name' : p.sort === 'room_number' ? 'rm.number' : 'x.' + p.sort
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM reservations x JOIN guests g ON g.id=x.guest_id JOIN rooms rm ON rm.id=x.room_id${w}`).bind(...args).first<{ n: number }>()
  const { results } = await c.env.DB.prepare(`${SEL}${w} ORDER BY ${sortCol} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, x.id DESC LIMIT ? OFFSET ?`).bind(...args, p.pageSize, p.offset).all()
  return c.json({ data: results, total: total!.n, page: p.page, pageSize: p.pageSize })
})

/** calendar feed: rooms + reservations overlapping a window */
reservations.get('/calendar', async (c) => {
  const from = c.req.query('from') || todayStr(), to = c.req.query('to') || addDays(from, 14)
  const { results: rms } = await c.env.DB.prepare(`SELECT r.id,r.number,r.floor,r.status,c.name category_name FROM rooms r JOIN room_categories c ON c.id=r.category_id ORDER BY CAST(r.number AS INTEGER)`).all()
  const { results: res } = await c.env.DB.prepare(`${SEL} WHERE x.status IN ('confirmed','checked_in','checked_out') AND x.check_in < ? AND x.check_out > ?`).bind(to, from).all()
  return c.json({ rooms: rms, reservations: res, from, to })
})

reservations.get('/reservations/:id', async (c) => {
  const id = +c.req.param('id')
  const r = await c.env.DB.prepare(`${SEL} WHERE x.id=?`).bind(id).first()
  if (!r) throw new HttpError(404, 'Reservation not found')
  const inv = await c.env.DB.prepare(`${INV_SELECT} WHERE i.reservation_id=?`).bind(id).first()
  return c.json({ ...r, invoice: inv ? computeInvoice(inv) : null })
})

async function validateStay(db: D1Database, v: any, exceptId = 0) {
  if (v.check_out <= v.check_in) throw bad('Validation failed', { check_out: 'Check-out must be after check-in' })
  const room = await db.prepare('SELECT * FROM rooms WHERE id=?').bind(v.room_id).first<any>()
  if (!room) throw bad('Validation failed', { room_id: 'Room not found' })
  if (room.status === 'maintenance') throw bad('Validation failed', { room_id: `Room ${room.number} is under maintenance` })
  const guestsN = (v.adults ?? 1) + (v.children ?? 0)
  if (guestsN > room.capacity) throw bad('Validation failed', { adults: `Room ${room.number} sleeps ${room.capacity} guests` })
  const g = await db.prepare('SELECT id FROM guests WHERE id=?').bind(v.guest_id).first()
  if (!g) throw bad('Validation failed', { guest_id: 'Guest not found' })
  const cf = await conflicts(db, v.room_id, v.check_in, v.check_out, exceptId)
  if (cf) throw new HttpError(409, `Room ${room.number} is already booked in those dates (${cf.code}, ${cf.guest})`)
  return room
}

reservations.post('/reservations', async (c) => {
  const user = c.get('user'); const db = c.env.DB
  const v = validate(await c.req.json(), spec)
  const today = todayStr()
  if (v.walk_in) { v.check_in = today; v.source = 'walk_in' }
  if (v.check_in < today && !v.walk_in) throw bad('Validation failed', { check_in: 'Check-in cannot be in the past' })
  const room = await validateStay(db, v)
  const rate = v.rate ?? room.price
  const nights = diffDays(v.check_in, v.check_out)
  const total = await calcTotal(db, rate, v.check_in, v.check_out)
  const code = mkCode()
  const r = await db.prepare(`INSERT INTO reservations (code,guest_id,room_id,check_in,check_out,adults,children,status,source,rate,nights,total,walk_in,notes,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(code, v.guest_id, v.room_id, v.check_in, v.check_out, v.adults ?? 1, v.children ?? 0, 'confirmed', v.source ?? 'direct', rate, nights, total, v.walk_in ? 1 : 0, v.notes ?? '', user.id).run()
  const id = r.meta.last_row_id as number
  const invId = await createInvoiceFor(db, id, v.guest_id)
  await syncRoomCharge(db, id, `Room ${room.number} (${nights} night${nights > 1 ? 's' : ''})`, nights, rate, total)
  await log(db, user, 'create', 'reservation', id, `${v.walk_in ? 'Walk-in' : 'New reservation'} ${code} for room ${room.number}, ${v.check_in} to ${v.check_out}`)
  if (v.walk_in) await doCheckIn(db, user, id, true)
  return c.json({ id, code, invoice_id: invId }, 201)
})

reservations.put('/reservations/:id', async (c) => {
  const id = +c.req.param('id'); const user = c.get('user'); const db = c.env.DB
  const cur = await db.prepare('SELECT * FROM reservations WHERE id=?').bind(id).first<any>()
  if (!cur) throw new HttpError(404, 'Reservation not found')
  if (['cancelled', 'checked_out'].includes(cur.status)) throw bad(`A ${cur.status.replace('_', ' ')} reservation cannot be edited`)
  const v = validate(await c.req.json(), spec, true)
  const merged = { ...cur, ...v }
  if (cur.status === 'checked_in' && (v.room_id !== undefined && v.room_id !== cur.room_id || v.check_in !== undefined && v.check_in !== cur.check_in))
    throw bad('Checked-in stays can only change check-out date')
  const room = await validateStay(db, merged, id)
  const nights = diffDays(merged.check_in, merged.check_out)
  const rate = v.rate ?? (v.room_id && v.room_id !== cur.room_id ? room.price : cur.rate)
  const total = await calcTotal(db, rate, merged.check_in, merged.check_out)
  await db.prepare(`UPDATE reservations SET guest_id=?,room_id=?,check_in=?,check_out=?,adults=?,children=?,source=?,rate=?,nights=?,total=?,notes=? WHERE id=?`)
    .bind(merged.guest_id, merged.room_id, merged.check_in, merged.check_out, merged.adults, merged.children, merged.source, rate, nights, total, merged.notes ?? '', id).run()
  await syncRoomCharge(db, id, `Room ${room.number} (${nights} night${nights > 1 ? 's' : ''})`, nights, rate, total)
  await log(db, user, 'update', 'reservation', id, `Updated reservation ${cur.code} (room ${room.number}, ${merged.check_in} to ${merged.check_out})`)
  return c.json({ ok: true })
})

async function doCheckIn(db: D1Database, user: any, id: number, force = false) {
  const r = await db.prepare(`SELECT x.*, rm.number, rm.status rstatus, rm.housekeeping_status hk FROM reservations x JOIN rooms rm ON rm.id=x.room_id WHERE x.id=?`).bind(id).first<any>()
  if (!r) throw new HttpError(404, 'Reservation not found')
  if (r.status !== 'confirmed') throw bad(`Only confirmed reservations can be checked in (this one is ${r.status.replace('_', ' ')})`)
  if (r.check_in > todayStr()) throw bad(`Check-in date is ${r.check_in}. Too early to check in.`)
  if (r.rstatus === 'maintenance') throw bad(`Room ${r.number} is under maintenance`)
  if (r.rstatus === 'occupied') throw bad(`Room ${r.number} still has a guest. Check them out first.`)
  if (r.hk !== 'clean' && r.hk !== 'inspected' && !force) throw bad(`Room ${r.number} is not ready (${r.hk}). Finish housekeeping first.`)
  await db.batch([
    db.prepare(`UPDATE reservations SET status='checked_in', checked_in_at=? WHERE id=?`).bind(nowStr(), id),
    db.prepare(`UPDATE rooms SET status='occupied' WHERE id=?`).bind(r.room_id),
  ])
  await log(db, user, 'check_in', 'reservation', id, `Checked in ${r.code} to room ${r.number}`)
}
reservations.post('/reservations/:id/check-in', async (c) => { await doCheckIn(c.env.DB, c.get('user'), +c.req.param('id'), (await c.req.json().catch(() => ({}))).force === true); return c.json({ ok: true }) })

reservations.post('/reservations/:id/check-out', async (c) => {
  const id = +c.req.param('id'); const user = c.get('user'); const db = c.env.DB
  const body = await c.req.json().catch(() => ({}))
  const r = await db.prepare(`SELECT x.*, rm.number FROM reservations x JOIN rooms rm ON rm.id=x.room_id WHERE x.id=?`).bind(id).first<any>()
  if (!r) throw new HttpError(404, 'Reservation not found')
  if (r.status !== 'checked_in') throw bad('Only checked-in guests can be checked out')
  const inv = await db.prepare(`${INV_SELECT} WHERE i.reservation_id=?`).bind(id).first()
  const t = inv ? computeInvoice(inv) : null
  if (t && t.balance > 0.004 && body.force !== true) throw new HttpError(402, `Outstanding balance of ${t.balance.toFixed(2)} on ${t.number}. Collect payment first.`, { balance: t.balance, invoice_id: t.id })
  const today = todayStr()
  await db.batch([
    db.prepare(`UPDATE reservations SET status='checked_out', checked_out_at=? WHERE id=?`).bind(nowStr(), id),
    db.prepare(`UPDATE rooms SET status='available', housekeeping_status='dirty' WHERE id=?`).bind(r.room_id),
    db.prepare(`INSERT INTO housekeeping_tasks (room_id,type,status,priority,scheduled_for,notes) VALUES (?,?,?,?,?,?)`).bind(r.room_id, 'checkout_cleaning', 'pending', 'high', today, `Checkout cleaning after ${r.code}`),
  ])
  await log(db, user, 'check_out', 'reservation', id, `Checked out ${r.code} from room ${r.number}`)
  return c.json({ ok: true })
})

reservations.post('/reservations/:id/cancel', async (c) => {
  const id = +c.req.param('id'); const user = c.get('user'); const db = c.env.DB
  const v = validate(await c.req.json(), { reason: { t: 'str', max: 300 }, refund_amount: { t: 'num', min: 0 }, refund_method: { t: 'str', oneOf: ['cash', 'card', 'bank_transfer', 'mobile_wallet', 'online'] }, no_show: { t: 'bool' } })
  const r = await db.prepare('SELECT * FROM reservations WHERE id=?').bind(id).first<any>()
  if (!r) throw new HttpError(404, 'Reservation not found')
  if (r.status !== 'confirmed') throw bad('Only confirmed reservations can be cancelled')
  const inv = await db.prepare(`${INV_SELECT} WHERE i.reservation_id=?`).bind(id).first()
  const t = inv ? computeInvoice(inv) : null
  const refund = v.refund_amount ?? 0
  if (refund > 0) {
    if (!t || refund > t.paid + 0.004) throw bad('Validation failed', { refund_amount: `Refund cannot exceed the amount paid (${(t?.paid ?? 0).toFixed(2)})` })
    await db.prepare(`INSERT INTO payments (invoice_id,amount,method,kind,reference,created_by,created_at) VALUES (?,?,?,?,?,?,?)`).bind(t.id, refund, v.refund_method ?? 'cash', 'refund', `Cancellation ${r.code}`, user.id, nowStr()).run()
  }
  await db.prepare(`UPDATE reservations SET status=?, cancelled_at=?, cancel_reason=?, refund_amount=? WHERE id=?`).bind(v.no_show ? 'no_show' : 'cancelled', nowStr(), v.reason ?? null, refund, id).run()
  if (t) await db.prepare(`UPDATE invoices SET status='void' WHERE id=?`).bind(t.id).run()
  await log(db, user, 'cancel', 'reservation', id, `${v.no_show ? 'Marked no-show' : 'Cancelled'} ${r.code}${refund ? `, refunded ${refund.toFixed(2)}` : ''}`)
  return c.json({ ok: true })
})
