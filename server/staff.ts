import { newApp, log } from './core'
import { validate, listParams, like, HttpError, bad, nowStr, todayStr, addDays } from './util'

export const staff = newApp()
const DEPTS = ['front_desk', 'housekeeping', 'maintenance', 'food_beverage', 'management', 'security', 'accounting'] as const
const spec = {
  name: { t: 'str', req: true, max: 120 }, department: { t: 'str', oneOf: DEPTS }, position: { t: 'str', max: 80 }, email: { t: 'email' },
  phone: { t: 'str', max: 40 }, hire_date: { t: 'date' }, salary: { t: 'num', min: 0 }, status: { t: 'str', oneOf: ['active', 'on_leave', 'terminated'] }, photo: { t: 'str', max: 300 },
} as const

staff.get('/staff', async (c) => {
  const q = c.req.query()
  const p = listParams(q, ['name', 'department', 'position', 'hire_date', 'status', 'avg_score'], 'name')
  const where: string[] = []; const args: any[] = []
  if (q.q) { where.push('(s.name LIKE ? OR s.position LIKE ? OR s.email LIKE ?)'); args.push(like(q.q), like(q.q), like(q.q)) }
  if (q.department) { where.push('s.department=?'); args.push(q.department) }
  if (q.status) { where.push('s.status=?'); args.push(q.status) }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : ''
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM staff s${w}`).bind(...args).first<{ n: number }>()
  const { results } = await c.env.DB.prepare(`SELECT s.*, (SELECT ROUND(AVG(score),1) FROM performance_reviews WHERE staff_id=s.id) AS avg_score,
    (SELECT COUNT(*) FROM attendance WHERE staff_id=s.id AND status='present' AND date>=?) AS present_30d,
    (SELECT COUNT(*) FROM housekeeping_tasks WHERE assigned_to=s.id AND status='completed') AS tasks_done
    FROM staff s${w} ORDER BY ${p.sort} ${q.dir === 'desc' ? 'DESC' : 'ASC'} LIMIT ? OFFSET ?`).bind(addDays(todayStr(), -30), ...args, p.pageSize, p.offset).all()
  return c.json({ data: results, total: total!.n, page: p.page, pageSize: p.pageSize })
})
staff.get('/staff/:id', async (c) => {
  const id = +c.req.param('id')
  const s = await c.env.DB.prepare('SELECT * FROM staff WHERE id=?').bind(id).first()
  if (!s) throw new HttpError(404, 'Employee not found')
  const { results: reviews } = await c.env.DB.prepare('SELECT * FROM performance_reviews WHERE staff_id=? ORDER BY period DESC').bind(id).all()
  const { results: shifts } = await c.env.DB.prepare('SELECT * FROM shifts WHERE staff_id=? AND date>=? ORDER BY date LIMIT 14').bind(id, todayStr()).all()
  const { results: att } = await c.env.DB.prepare('SELECT * FROM attendance WHERE staff_id=? ORDER BY date DESC LIMIT 30').bind(id).all()
  return c.json({ ...s, reviews, shifts, attendance: att })
})
staff.post('/staff', async (c) => {
  const v = validate(await c.req.json(), spec)
  const r = await c.env.DB.prepare('INSERT INTO staff (name,department,position,email,phone,hire_date,salary,status,photo) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(v.name, v.department ?? 'front_desk', v.position ?? '', v.email ?? null, v.phone ?? null, v.hire_date ?? todayStr(), v.salary ?? 0, v.status ?? 'active', v.photo ?? null).run()
  await log(c.env.DB, c.get('user'), 'create', 'staff', r.meta.last_row_id, `Added employee ${v.name}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
staff.put('/staff/:id', async (c) => {
  const id = +c.req.param('id'); const v = validate(await c.req.json(), spec, true)
  const keys = Object.keys(v); if (!keys.length) throw bad('Nothing to update')
  await c.env.DB.prepare(`UPDATE staff SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => v[k]), id).run()
  await log(c.env.DB, c.get('user'), 'update', 'staff', id, `Updated employee #${id}`)
  return c.json({ ok: true })
})
staff.delete('/staff/:id', async (c) => {
  const id = +c.req.param('id')
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE housekeeping_tasks SET assigned_to=NULL WHERE assigned_to=?').bind(id),
    c.env.DB.prepare('UPDATE maintenance_requests SET assigned_to=NULL WHERE assigned_to=?').bind(id),
    c.env.DB.prepare('UPDATE users SET staff_id=NULL WHERE staff_id=?').bind(id),
    c.env.DB.prepare('DELETE FROM staff WHERE id=?').bind(id),
  ])
  await log(c.env.DB, c.get('user'), 'delete', 'staff', id, `Removed employee #${id}`)
  return c.json({ ok: true })
})

// ---- shifts
const SHIFT_TIMES: Record<string, [string, string]> = { morning: ['07:00', '15:00'], evening: ['15:00', '23:00'], night: ['23:00', '07:00'] }
staff.get('/shifts', async (c) => {
  const from = c.req.query('from') || todayStr(), to = c.req.query('to') || addDays(from, 6)
  const { results } = await c.env.DB.prepare(`SELECT sh.*, s.name staff_name, s.department FROM shifts sh JOIN staff s ON s.id=sh.staff_id WHERE sh.date>=? AND sh.date<=? ORDER BY sh.date, sh.start_time`).bind(from, to).all()
  return c.json(results)
})
staff.post('/shifts', async (c) => {
  const v = validate(await c.req.json(), { staff_id: { t: 'int', req: true }, date: { t: 'date', req: true }, shift: { t: 'str', req: true, oneOf: ['morning', 'evening', 'night'] }, start_time: { t: 'str', max: 5 }, end_time: { t: 'str', max: 5 } })
  const [s, e] = SHIFT_TIMES[v.shift]
  const dup = await c.env.DB.prepare('SELECT id FROM shifts WHERE staff_id=? AND date=?').bind(v.staff_id, v.date).first()
  if (dup) throw bad('This employee already has a shift on that day')
  const r = await c.env.DB.prepare('INSERT INTO shifts (staff_id,date,shift,start_time,end_time) VALUES (?,?,?,?,?)').bind(v.staff_id, v.date, v.shift, v.start_time ?? s, v.end_time ?? e).run()
  await log(c.env.DB, c.get('user'), 'create', 'shift', r.meta.last_row_id, `Scheduled ${v.shift} shift on ${v.date}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
staff.delete('/shifts/:id', async (c) => { await c.env.DB.prepare('DELETE FROM shifts WHERE id=?').bind(+c.req.param('id')).run(); return c.json({ ok: true }) })

// ---- attendance
staff.get('/attendance', async (c) => {
  const date = c.req.query('date') || todayStr()
  const { results } = await c.env.DB.prepare(`SELECT s.id staff_id, s.name staff_name, s.department, a.id, a.date, a.check_in, a.check_out, COALESCE(a.status,'absent') status
    FROM staff s LEFT JOIN attendance a ON a.staff_id=s.id AND a.date=? WHERE s.status='active' ORDER BY s.name`).bind(date).all()
  return c.json({ date, data: results })
})
staff.post('/attendance', async (c) => {
  const v = validate(await c.req.json(), { staff_id: { t: 'int', req: true }, date: { t: 'date' }, action: { t: 'str', req: true, oneOf: ['check_in', 'check_out', 'absent', 'late', 'leave'] }, time: { t: 'str', max: 5 } })
  const date = v.date ?? todayStr()
  const hhmm = v.time ?? new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' }).format(new Date())
  const cur = await c.env.DB.prepare('SELECT * FROM attendance WHERE staff_id=? AND date=?').bind(v.staff_id, date).first<any>()
  if (v.action === 'check_in') {
    if (cur?.check_in) throw bad('Already clocked in')
    if (cur) await c.env.DB.prepare(`UPDATE attendance SET check_in=?, status='present' WHERE id=?`).bind(hhmm, cur.id).run()
    else await c.env.DB.prepare(`INSERT INTO attendance (staff_id,date,check_in,status) VALUES (?,?,?,'present')`).bind(v.staff_id, date, hhmm).run()
  } else if (v.action === 'check_out') {
    if (!cur?.check_in) throw bad('Clock in first')
    if (cur.check_out) throw bad('Already clocked out')
    await c.env.DB.prepare('UPDATE attendance SET check_out=? WHERE id=?').bind(hhmm, cur.id).run()
  } else {
    const st = v.action === 'leave' ? 'leave' : v.action
    if (cur) await c.env.DB.prepare('UPDATE attendance SET status=? WHERE id=?').bind(st, cur.id).run()
    else await c.env.DB.prepare('INSERT INTO attendance (staff_id,date,status) VALUES (?,?,?)').bind(v.staff_id, date, st).run()
  }
  await log(c.env.DB, c.get('user'), 'update', 'attendance', v.staff_id, `Attendance ${v.action.replace('_', ' ')} for employee #${v.staff_id}`)
  return c.json({ ok: true })
})

// ---- performance
staff.post('/staff/:id/reviews', async (c) => {
  const id = +c.req.param('id')
  const v = validate(await c.req.json(), { period: { t: 'str', req: true, max: 20 }, score: { t: 'num', req: true, min: 0 }, notes: { t: 'str', max: 500 } })
  if (v.score > 5) throw bad('Validation failed', { score: 'Score is 0 to 5' })
  const r = await c.env.DB.prepare('INSERT INTO performance_reviews (staff_id,period,score,notes,created_at) VALUES (?,?,?,?,?)').bind(id, v.period, v.score, v.notes ?? '', nowStr()).run()
  await log(c.env.DB, c.get('user'), 'create', 'staff', id, `Performance review added for employee #${id}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
staff.delete('/reviews/:id', async (c) => { await c.env.DB.prepare('DELETE FROM performance_reviews WHERE id=?').bind(+c.req.param('id')).run(); return c.json({ ok: true }) })
