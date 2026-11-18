import { newApp, log, getSettings } from './core'
import { validate, listParams, like, HttpError, bad, nowStr, round2 } from './util'

export const billing = newApp()

/** invoice totals computed in SQL so lists and details always agree */
export const INV_SELECT = `SELECT i.*, g.name AS guest_name, r.code AS reservation_code, rm.number AS room_number,
  COALESCE((SELECT SUM(quantity*unit_price) FROM invoice_items WHERE invoice_id=i.id),0) AS subtotal,
  COALESCE((SELECT SUM(CASE WHEN kind='payment' THEN amount ELSE -amount END) FROM payments WHERE invoice_id=i.id),0) AS paid
  FROM invoices i JOIN guests g ON g.id=i.guest_id LEFT JOIN reservations r ON r.id=i.reservation_id LEFT JOIN rooms rm ON rm.id=r.room_id`

export function computeInvoice(i: any) {
  const net = Math.max(0, i.subtotal - i.discount)
  const service = round2(net * i.service_rate / 100)
  const tax = round2((net + service) * i.tax_rate / 100)
  const total = round2(net + service + tax)
  const paid = round2(i.paid)
  const balance = round2(total - paid)
  const state = i.status === 'void' ? 'void' : total > 0 && balance <= 0.004 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  return { ...i, service, tax, total, paid, balance, state }
}

export async function syncRoomCharge(db: D1Database, reservationId: number, description: string, nights: number, rate: number, total: number) {
  const inv = await db.prepare('SELECT id FROM invoices WHERE reservation_id=?').bind(reservationId).first<{ id: number }>()
  if (!inv) return
  const item = await db.prepare(`SELECT id FROM invoice_items WHERE invoice_id=? AND type='room'`).bind(inv.id).first<{ id: number }>()
  const avg = nights > 0 ? round2(total / nights) : rate
  if (item) await db.prepare('UPDATE invoice_items SET description=?,quantity=?,unit_price=? WHERE id=?').bind(description, nights, avg, item.id).run()
  else await db.prepare(`INSERT INTO invoice_items (invoice_id,type,description,quantity,unit_price) VALUES (?,?,?,?,?)`).bind(inv.id, 'room', description, nights, avg).run()
}

export async function createInvoiceFor(db: D1Database, reservationId: number | null, guestId: number) {
  const s = await getSettings(db)
  const r = await db.prepare(`INSERT INTO invoices (number,reservation_id,guest_id,tax_rate,service_rate,issued_at) VALUES (?,?,?,?,?,?)`)
    .bind('TMP-' + Math.random().toString(36).slice(2), reservationId, guestId, Number(s.tax_rate ?? 0), Number(s.service_rate ?? 0), nowStr()).run()
  const id = r.meta.last_row_id as number
  await db.prepare('UPDATE invoices SET number=? WHERE id=?').bind(`INV-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`, id).run()
  return id
}

billing.get('/invoices', async (c) => {
  const q = c.req.query()
  const p = listParams(q, ['number', 'issued_at', 'guest_name', 'subtotal', 'paid'], 'issued_at')
  const where: string[] = []; const args: any[] = []
  if (q.q) { where.push('(i.number LIKE ? OR g.name LIKE ? OR r.code LIKE ?)'); args.push(like(q.q), like(q.q), like(q.q)) }
  if (q.guest_id) { where.push('i.guest_id=?'); args.push(+q.guest_id) }
  if (q.reservation_id) { where.push('i.reservation_id=?'); args.push(+q.reservation_id) }
  if (q.from) { where.push('date(i.issued_at)>=?'); args.push(q.from) }
  if (q.to) { where.push('date(i.issued_at)<=?'); args.push(q.to) }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : ''
  // state filter is computed, so filter after computing when requested
  const { results } = await c.env.DB.prepare(`${INV_SELECT}${w} ORDER BY ${p.sort === 'guest_name' ? 'g.name' : 'i.' + p.sort} ${q.dir === 'asc' ? 'ASC' : 'DESC'}`).bind(...args).all()
  let rows = results.map(computeInvoice)
  if (q.state) rows = rows.filter((r: any) => (q.state === 'outstanding' ? r.balance > 0.004 && r.state !== 'void' : r.state === q.state))
  const sums = { total: round2(rows.reduce((a: number, r: any) => a + (r.state === 'void' ? 0 : r.total), 0)), paid: round2(rows.reduce((a: number, r: any) => a + r.paid, 0)), outstanding: round2(rows.reduce((a: number, r: any) => a + (r.state === 'void' ? 0 : Math.max(0, r.balance)), 0)) }
  return c.json({ data: rows.slice(p.offset, p.offset + p.pageSize), total: rows.length, page: p.page, pageSize: p.pageSize, sums })
})
billing.get('/invoices/:id', async (c) => {
  const id = +c.req.param('id')
  const i = await c.env.DB.prepare(`${INV_SELECT} WHERE i.id=?`).bind(id).first()
  if (!i) throw new HttpError(404, 'Invoice not found')
  const { results: items } = await c.env.DB.prepare('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id').bind(id).all()
  const { results: payments } = await c.env.DB.prepare('SELECT p.*, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id=p.created_by WHERE invoice_id=? ORDER BY p.id').bind(id).all()
  const g = await c.env.DB.prepare('SELECT name,email,phone,address FROM guests WHERE id=?').bind((i as any).guest_id).first()
  return c.json({ ...computeInvoice(i), items, payments, guest: g })
})
billing.post('/invoices', async (c) => {
  const v = validate(await c.req.json(), { guest_id: { t: 'int', req: true }, reservation_id: { t: 'int' }, notes: { t: 'str', max: 500 } })
  const id = await createInvoiceFor(c.env.DB, v.reservation_id ?? null, v.guest_id)
  if (v.notes) await c.env.DB.prepare('UPDATE invoices SET notes=? WHERE id=?').bind(v.notes, id).run()
  await log(c.env.DB, c.get('user'), 'create', 'invoice', id, `Created invoice #${id}`)
  return c.json({ id }, 201)
})
billing.put('/invoices/:id', async (c) => {
  const id = +c.req.param('id')
  const v = validate(await c.req.json(), { discount: { t: 'num', min: 0 }, tax_rate: { t: 'num', min: 0 }, service_rate: { t: 'num', min: 0 }, notes: { t: 'str', max: 500 }, status: { t: 'str', oneOf: ['open', 'void'] } }, true)
  const keys = Object.keys(v); if (!keys.length) throw bad('Nothing to update')
  await c.env.DB.prepare(`UPDATE invoices SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => v[k]), id).run()
  await log(c.env.DB, c.get('user'), 'update', 'invoice', id, `Updated invoice #${id}`)
  return c.json({ ok: true })
})
billing.post('/invoices/:id/items', async (c) => {
  const id = +c.req.param('id')
  const v = validate(await c.req.json(), { type: { t: 'str', oneOf: ['room', 'service', 'food', 'minibar', 'laundry', 'spa', 'transport', 'other'] }, description: { t: 'str', req: true, max: 200 }, quantity: { t: 'num', req: true, min: 0.01 }, unit_price: { t: 'num', req: true, min: 0 } })
  const r = await c.env.DB.prepare('INSERT INTO invoice_items (invoice_id,type,description,quantity,unit_price) VALUES (?,?,?,?,?)').bind(id, v.type ?? 'service', v.description, v.quantity, v.unit_price).run()
  await log(c.env.DB, c.get('user'), 'create', 'invoice', id, `Added charge "${v.description}" to invoice #${id}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
billing.delete('/invoices/:id/items/:itemId', async (c) => {
  const id = +c.req.param('id'), itemId = +c.req.param('itemId')
  const it = await c.env.DB.prepare('SELECT type FROM invoice_items WHERE id=? AND invoice_id=?').bind(itemId, id).first<{ type: string }>()
  if (!it) throw new HttpError(404, 'Item not found')
  await c.env.DB.prepare('DELETE FROM invoice_items WHERE id=?').bind(itemId).run()
  await log(c.env.DB, c.get('user'), 'delete', 'invoice', id, `Removed a charge from invoice #${id}`)
  return c.json({ ok: true })
})
billing.post('/invoices/:id/payments', async (c) => {
  const id = +c.req.param('id'); const user = c.get('user')
  const v = validate(await c.req.json(), { amount: { t: 'num', req: true, min: 0.01 }, method: { t: 'str', req: true, oneOf: ['cash', 'card', 'bank_transfer', 'mobile_wallet', 'online'] }, kind: { t: 'str', oneOf: ['payment', 'refund'] }, reference: { t: 'str', max: 80 } })
  const inv = await c.env.DB.prepare(`${INV_SELECT} WHERE i.id=?`).bind(id).first()
  if (!inv) throw new HttpError(404, 'Invoice not found')
  const t = computeInvoice(inv)
  if (t.state === 'void') throw bad('Invoice is void')
  const kind = v.kind ?? 'payment'
  if (kind === 'payment' && v.amount > t.balance + 0.004) throw bad(`Amount exceeds the outstanding balance (${t.balance.toFixed(2)})`)
  if (kind === 'refund' && v.amount > t.paid + 0.004) throw bad(`Refund exceeds the amount paid (${t.paid.toFixed(2)})`)
  const r = await c.env.DB.prepare('INSERT INTO payments (invoice_id,amount,method,kind,reference,created_by,created_at) VALUES (?,?,?,?,?,?,?)').bind(id, v.amount, v.method, kind, v.reference ?? null, user.id, nowStr()).run()
  await log(c.env.DB, user, kind === 'refund' ? 'refund' : 'payment', 'invoice', id, `${kind === 'refund' ? 'Refunded' : 'Received'} ${v.amount.toFixed(2)} (${v.method}) on ${t.number}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
