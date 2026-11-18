import { newApp } from './core'
import { todayStr, addDays, diffDays, round2, bad } from './util'
import { INV_SELECT, computeInvoice } from './billing'

export const reports = newApp()

function range(q: Record<string, string>) {
  const to = /^\d{4}-\d{2}-\d{2}$/.test(q.to || '') ? q.to : todayStr()
  const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : addDays(to, -29)
  if (from > to) throw bad('"from" must be before "to"')
  if (diffDays(from, to) > 800) throw bad('Range too large (max 800 days)')
  return { from, to }
}
const group = (q: Record<string, string>, from: string, to: string) => (q.group === 'month' || (!q.group && diffDays(from, to) > 92) ? 'month' : 'day')
const keyOf = (d: string, g: string) => (g === 'month' ? d.slice(0, 7) : d)
function buckets(from: string, to: string, g: string) {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) { const k = keyOf(d, g); if (out[out.length - 1] !== k) out.push(k) }
  return out
}

reports.get('/reports/revenue', async (c) => {
  const { from, to } = range(c.req.query()); const g = group(c.req.query(), from, to)
  const { results } = await c.env.DB.prepare(`SELECT date(created_at) d, method, kind, amount FROM payments WHERE date(created_at)>=? AND date(created_at)<=?`).bind(from, to).all<any>()
  const series = new Map(buckets(from, to, g).map((k) => [k, 0])); const methods: Record<string, number> = {}
  let gross = 0, refunds = 0
  for (const p of results) {
    const s = p.kind === 'payment' ? p.amount : -p.amount
    series.set(keyOf(p.d, g), (series.get(keyOf(p.d, g)) ?? 0) + s)
    methods[p.method] = (methods[p.method] ?? 0) + s
    if (p.kind === 'payment') gross += p.amount; else refunds += p.amount
  }
  return c.json({ from, to, group: g, series: [...series].map(([date, revenue]) => ({ date, revenue: round2(revenue) })), methods: Object.entries(methods).map(([method, amount]) => ({ method, amount: round2(amount) })), totals: { gross: round2(gross), refunds: round2(refunds), net: round2(gross - refunds), transactions: results.length } })
})

reports.get('/reports/occupancy', async (c) => {
  const { from, to } = range(c.req.query()); const g = group(c.req.query(), from, to)
  const total = (await c.env.DB.prepare('SELECT COUNT(*) n FROM rooms').first<{ n: number }>())!.n
  const { results } = await c.env.DB.prepare(`SELECT x.check_in,x.check_out,x.total,x.nights,c.name cat FROM reservations x JOIN rooms r ON r.id=x.room_id JOIN room_categories c ON c.id=r.category_id WHERE x.status IN ('confirmed','checked_in','checked_out') AND x.check_in<=? AND x.check_out>?`).bind(to, from).all<any>()
  const nightsBy = new Map<string, number>(); const catNights: Record<string, number> = {}; let roomNights = 0, revenue = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    let n = 0
    for (const r of results) if (r.check_in <= d && r.check_out > d) { n++; catNights[r.cat] = (catNights[r.cat] ?? 0) + 1; revenue += r.total / Math.max(1, r.nights) }
    nightsBy.set(d, n); roomNights += n
  }
  const days = diffDays(from, to) + 1
  const per = new Map<string, { n: number; days: number }>()
  for (const [d, n] of nightsBy) { const k = keyOf(d, g); const e = per.get(k) ?? { n: 0, days: 0 }; e.n += n; e.days++; per.set(k, e) }
  const available = total * days
  return c.json({ from, to, group: g, rooms: total, series: [...per].map(([date, e]) => ({ date, occupancy: total ? round2((e.n / (total * e.days)) * 100) : 0 })),
    byCategory: Object.entries(catNights).map(([category, nights]) => ({ category, nights })),
    totals: { occupancy: available ? round2((roomNights / available) * 100) : 0, room_nights: roomNights, available_nights: available, adr: roomNights ? round2(revenue / roomNights) : 0, revpar: available ? round2(revenue / available) : 0 } })
})

reports.get('/reports/bookings', async (c) => {
  const { from, to } = range(c.req.query()); const g = group(c.req.query(), from, to)
  const { results } = await c.env.DB.prepare(`SELECT x.status,x.source,x.nights,x.total,date(x.created_at) d,c.name cat FROM reservations x JOIN rooms r ON r.id=x.room_id JOIN room_categories c ON c.id=r.category_id WHERE date(x.created_at)>=? AND date(x.created_at)<=?`).bind(from, to).all<any>()
  const series = new Map(buckets(from, to, g).map((k) => [k, { bookings: 0, cancelled: 0 }]))
  const cnt = (key: string) => { const m: Record<string, number> = {}; for (const r of results) m[r[key]] = (m[r[key]] ?? 0) + 1; return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) }
  for (const r of results) { const e = series.get(keyOf(r.d, g)); if (!e) continue; e.bookings++; if (r.status === 'cancelled' || r.status === 'no_show') e.cancelled++ }
  const active = results.filter((r: any) => !['cancelled', 'no_show'].includes(r.status))
  const lead = await c.env.DB.prepare(`SELECT AVG(julianday(check_in)-julianday(date(created_at))) l FROM reservations WHERE date(created_at)>=? AND date(created_at)<=? AND status!='cancelled'`).bind(from, to).first<{ l: number }>()
  return c.json({ from, to, group: g, series: [...series].map(([date, v]) => ({ date, ...v })), bySource: cnt('source'), byStatus: cnt('status'), byCategory: cnt('cat'),
    totals: { bookings: results.length, cancelled: results.length - active.length, cancellation_rate: results.length ? round2(((results.length - active.length) / results.length) * 100) : 0, avg_stay: active.length ? round2(active.reduce((a: number, r: any) => a + r.nights, 0) / active.length) : 0, avg_lead_days: round2(lead?.l ?? 0), booked_value: round2(active.reduce((a: number, r: any) => a + r.total, 0)) } })
})

reports.get('/reports/guests', async (c) => {
  const { from, to } = range(c.req.query())
  const db = c.env.DB
  const { results: nat } = await db.prepare(`SELECT COALESCE(g.nationality,'Unknown') name, COUNT(DISTINCT g.id) count FROM guests g JOIN reservations x ON x.guest_id=g.id WHERE x.status IN ('checked_in','checked_out') AND x.check_in<=? AND x.check_out>=? GROUP BY 1 ORDER BY count DESC LIMIT 10`).bind(to, from).all()
  const stats = await db.prepare(`SELECT COUNT(*) total, SUM(vip) vip, SUM(date(created_at)>=? AND date(created_at)<=?) new_guests FROM guests`).bind(from, to).first<any>()
  const returning = await db.prepare(`SELECT COUNT(*) n FROM (SELECT guest_id FROM reservations WHERE status IN ('checked_in','checked_out') GROUP BY guest_id HAVING COUNT(*)>1)`).first<{ n: number }>()
  const inRange = await db.prepare(`SELECT COUNT(DISTINCT guest_id) n FROM reservations WHERE status IN ('checked_in','checked_out') AND check_in<=? AND check_out>=?`).bind(to, from).first<{ n: number }>()
  const { results: top } = await db.prepare(`SELECT g.id, g.name, g.vip, g.nationality, COUNT(DISTINCT x.id) stays, (SELECT COALESCE(SUM(CASE WHEN p.kind='payment' THEN p.amount ELSE -p.amount END),0) FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.guest_id=g.id) spent FROM guests g JOIN reservations x ON x.guest_id=g.id AND x.status IN ('checked_in','checked_out') GROUP BY g.id ORDER BY spent DESC LIMIT 10`).all()
  const { results: sources } = await db.prepare(`SELECT source name, COUNT(*) count FROM reservations WHERE status!='cancelled' AND check_in<=? AND check_out>=? GROUP BY source ORDER BY count DESC`).bind(to, from).all()
  const party = await db.prepare(`SELECT COALESCE(SUM(adults),0) a, COALESCE(SUM(children),0) k FROM reservations WHERE status IN ('checked_in','checked_out') AND check_in<=? AND check_out>=?`).bind(to, from).first<any>()
  return c.json({ from, to, nationalities: nat, top, sources, totals: { guests: stats.total, vip: stats.vip ?? 0, new_guests: stats.new_guests ?? 0, returning_guests: returning!.n, guests_in_period: inRange!.n, adults: party.a, children: party.k } })
})

reports.get('/reports/financial', async (c) => {
  const { from, to } = range(c.req.query()); const db = c.env.DB
  const { results: invs } = await db.prepare(`${INV_SELECT} WHERE i.status!='void' AND date(i.issued_at)>=? AND date(i.issued_at)<=?`).bind(from, to).all<any>()
  const rows = invs.map(computeInvoice)
  const { results: items } = await db.prepare(`SELECT it.type, SUM(it.quantity*it.unit_price) amount FROM invoice_items it JOIN invoices i ON i.id=it.invoice_id WHERE i.status!='void' AND date(i.issued_at)>=? AND date(i.issued_at)<=? GROUP BY it.type ORDER BY amount DESC`).bind(from, to).all<any>()
  const { results: pay } = await db.prepare(`SELECT kind, method, SUM(amount) amount FROM payments WHERE date(created_at)>=? AND date(created_at)<=? GROUP BY kind, method`).bind(from, to).all<any>()
  const { results: outstanding } = await db.prepare(`${INV_SELECT} WHERE i.status!='void'`).all<any>()
  const out = outstanding.map(computeInvoice).filter((i: any) => i.balance > 0.004).sort((a: any, b: any) => b.balance - a.balance)
  const sum = (k: string) => round2(rows.reduce((a: number, r: any) => a + r[k], 0))
  const refunds = round2(pay.filter((p: any) => p.kind === 'refund').reduce((a: number, p: any) => a + p.amount, 0))
  const collected = round2(pay.filter((p: any) => p.kind === 'payment').reduce((a: number, p: any) => a + p.amount, 0))
  return c.json({ from, to, byType: items.map((i: any) => ({ type: i.type, amount: round2(i.amount) })), invoices: rows.length,
    outstanding: out.slice(0, 20).map((i: any) => ({ id: i.id, number: i.number, guest_name: i.guest_name, total: i.total, paid: i.paid, balance: i.balance, room_number: i.room_number })),
    totals: { invoiced: sum('total'), subtotal: sum('subtotal'), discounts: sum('discount'), tax: sum('tax'), service: sum('service'), collected, refunds, net_collected: round2(collected - refunds), outstanding_total: round2(out.reduce((a: number, i: any) => a + i.balance, 0)) } })
})
