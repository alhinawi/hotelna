import { newApp, log } from './core'
import { validate, listParams, like, HttpError, bad, nowStr, todayStr } from './util'

export const housekeeping = newApp()
const taskSpec = {
  room_id: { t: 'int', req: true }, type: { t: 'str', oneOf: ['cleaning', 'checkout_cleaning', 'deep_cleaning', 'turndown', 'inspection', 'laundry'] },
  assigned_to: { t: 'int' }, status: { t: 'str', oneOf: ['pending', 'in_progress', 'completed', 'cancelled'] },
  priority: { t: 'str', oneOf: ['low', 'normal', 'high', 'urgent'] }, scheduled_for: { t: 'date', req: true }, notes: { t: 'str', max: 500 },
} as const
const TSEL = `SELECT t.*, r.number AS room_number, r.floor AS room_floor, s.name AS staff_name FROM housekeeping_tasks t JOIN rooms r ON r.id=t.room_id LEFT JOIN staff s ON s.id=t.assigned_to`

housekeeping.get('/housekeeping/tasks', async (c) => {
  const q = c.req.query()
  const p = listParams(q, ['scheduled_for', 'priority', 'status', 'room_number', 'created_at'], 'scheduled_for')
  const where: string[] = []; const args: any[] = []
  if (q.q) { where.push('(r.number LIKE ? OR s.name LIKE ? OR t.notes LIKE ?)'); args.push(like(q.q), like(q.q), like(q.q)) }
  if (q.status) { where.push('t.status=?'); args.push(q.status) }
  if (q.assigned_to) { where.push('t.assigned_to=?'); args.push(+q.assigned_to) }
  if (q.date) { where.push('t.scheduled_for=?'); args.push(q.date) }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : ''
  const sortCol = p.sort === 'room_number' ? 'CAST(r.number AS INTEGER)' : p.sort === 'priority' ? `CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END` : 't.' + p.sort
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM housekeeping_tasks t JOIN rooms r ON r.id=t.room_id LEFT JOIN staff s ON s.id=t.assigned_to${w}`).bind(...args).first<{ n: number }>()
  const { results } = await c.env.DB.prepare(`${TSEL}${w} ORDER BY ${sortCol} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, t.id DESC LIMIT ? OFFSET ?`).bind(...args, p.pageSize, p.offset).all()
  const summary = await c.env.DB.prepare(`SELECT status, COUNT(*) n FROM housekeeping_tasks GROUP BY status`).all()
  return c.json({ data: results, total: total!.n, page: p.page, pageSize: p.pageSize, summary: summary.results })
})
housekeeping.post('/housekeeping/tasks', async (c) => {
  const v = validate(await c.req.json(), taskSpec)
  const room = await c.env.DB.prepare('SELECT number FROM rooms WHERE id=?').bind(v.room_id).first<any>()
  if (!room) throw bad('Validation failed', { room_id: 'Room not found' })
  const r = await c.env.DB.prepare('INSERT INTO housekeeping_tasks (room_id,type,assigned_to,status,priority,scheduled_for,notes) VALUES (?,?,?,?,?,?,?)')
    .bind(v.room_id, v.type ?? 'cleaning', v.assigned_to ?? null, 'pending', v.priority ?? 'normal', v.scheduled_for, v.notes ?? '').run()
  await log(c.env.DB, c.get('user'), 'create', 'housekeeping', r.meta.last_row_id, `New ${(v.type ?? 'cleaning').replace('_', ' ')} task for room ${room.number}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
housekeeping.put('/housekeeping/tasks/:id', async (c) => {
  const id = +c.req.param('id'); const db = c.env.DB
  const v = validate(await c.req.json(), taskSpec, true)
  const cur = await db.prepare('SELECT * FROM housekeeping_tasks WHERE id=?').bind(id).first<any>()
  if (!cur) throw new HttpError(404, 'Task not found')
  const extra: Record<string, any> = {}
  if (v.status && v.status !== cur.status) {
    if (v.status === 'in_progress') extra.started_at = nowStr()
    if (v.status === 'completed') extra.completed_at = nowStr()
  }
  const all = { ...v, ...extra }; const keys = Object.keys(all)
  if (!keys.length) throw bad('Nothing to update')
  await db.prepare(`UPDATE housekeeping_tasks SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => all[k]), id).run()
  const roomId = v.room_id ?? cur.room_id
  const t = v.type ?? cur.type
  if (v.status && v.status !== cur.status && t !== 'inspection' && t !== 'laundry') {
    if (v.status === 'in_progress') await db.prepare(`UPDATE rooms SET housekeeping_status='cleaning' WHERE id=?`).bind(roomId).run()
    if (v.status === 'completed') await db.prepare(`UPDATE rooms SET housekeeping_status='clean' WHERE id=?`).bind(roomId).run()
  }
  const room = await db.prepare('SELECT number FROM rooms WHERE id=?').bind(roomId).first<any>()
  await log(db, c.get('user'), 'update', 'housekeeping', id, v.status ? `Task for room ${room?.number} is now ${v.status.replace('_', ' ')}` : `Updated housekeeping task for room ${room?.number}`)
  return c.json({ ok: true })
})
housekeeping.delete('/housekeeping/tasks/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM housekeeping_tasks WHERE id=?').bind(+c.req.param('id')).run()
  return c.json({ ok: true })
})
/** one click: generate cleaning tasks for every dirty room that has none open */
housekeeping.post('/housekeeping/generate', async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(`SELECT id,number FROM rooms WHERE housekeeping_status='dirty' AND id NOT IN (SELECT room_id FROM housekeeping_tasks WHERE status IN ('pending','in_progress'))`).all<any>()
  for (const r of results) await db.prepare(`INSERT INTO housekeeping_tasks (room_id,type,status,priority,scheduled_for,notes) VALUES (?,?,?,?,?,?)`).bind(r.id, 'cleaning', 'pending', 'normal', todayStr(), 'Auto-generated for dirty room').run()
  await log(db, c.get('user'), 'create', 'housekeeping', null, `Generated ${results.length} cleaning task(s) for dirty rooms`)
  return c.json({ created: results.length })
})

// ---- maintenance
const mSpec = {
  room_id: { t: 'int' }, title: { t: 'str', req: true, max: 150 }, description: { t: 'str', max: 1000 },
  priority: { t: 'str', oneOf: ['low', 'normal', 'high', 'urgent'] }, status: { t: 'str', oneOf: ['open', 'in_progress', 'resolved'] }, assigned_to: { t: 'int' },
} as const
const MSEL = `SELECT m.*, r.number AS room_number, s.name AS staff_name FROM maintenance_requests m LEFT JOIN rooms r ON r.id=m.room_id LEFT JOIN staff s ON s.id=m.assigned_to`
housekeeping.get('/maintenance', async (c) => {
  const q = c.req.query()
  const p = listParams(q, ['created_at', 'priority', 'status', 'title'], 'created_at')
  const where: string[] = []; const args: any[] = []
  if (q.q) { where.push('(m.title LIKE ? OR r.number LIKE ?)'); args.push(like(q.q), like(q.q)) }
  if (q.status) { where.push('m.status=?'); args.push(q.status) }
  const w = where.length ? ' WHERE ' + where.join(' AND ') : ''
  const total = await c.env.DB.prepare(`SELECT COUNT(*) n FROM maintenance_requests m LEFT JOIN rooms r ON r.id=m.room_id${w}`).bind(...args).first<{ n: number }>()
  const { results } = await c.env.DB.prepare(`${MSEL}${w} ORDER BY m.${p.sort} ${q.dir === 'asc' ? 'ASC' : 'DESC'}, m.id DESC LIMIT ? OFFSET ?`).bind(...args, p.pageSize, p.offset).all()
  return c.json({ data: results, total: total!.n, page: p.page, pageSize: p.pageSize })
})
housekeeping.post('/maintenance', async (c) => {
  const v = validate(await c.req.json(), mSpec)
  const r = await c.env.DB.prepare('INSERT INTO maintenance_requests (room_id,title,description,priority,status,reported_by,assigned_to,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(v.room_id ?? null, v.title, v.description ?? '', v.priority ?? 'normal', 'open', c.get('user').id, v.assigned_to ?? null, nowStr()).run()
  await log(c.env.DB, c.get('user'), 'create', 'maintenance', r.meta.last_row_id, `Maintenance request: ${v.title}`)
  return c.json({ id: r.meta.last_row_id }, 201)
})
housekeeping.put('/maintenance/:id', async (c) => {
  const id = +c.req.param('id'); const db = c.env.DB
  const v = validate(await c.req.json(), mSpec, true)
  const cur = await db.prepare('SELECT * FROM maintenance_requests WHERE id=?').bind(id).first<any>()
  if (!cur) throw new HttpError(404, 'Request not found')
  const all: Record<string, any> = { ...v }
  if (v.status === 'resolved' && cur.status !== 'resolved') all.resolved_at = nowStr()
  const keys = Object.keys(all); if (!keys.length) throw bad('Nothing to update')
  await db.prepare(`UPDATE maintenance_requests SET ${keys.map((k) => k + '=?').join(',')} WHERE id=?`).bind(...keys.map((k) => all[k]), id).run()
  const roomId = v.room_id ?? cur.room_id
  if (roomId && v.status && v.status !== cur.status) {
    const occ = await db.prepare(`SELECT status FROM rooms WHERE id=?`).bind(roomId).first<any>()
    if (v.status === 'in_progress' && occ?.status === 'available') await db.prepare(`UPDATE rooms SET status='maintenance' WHERE id=?`).bind(roomId).run()
    if (v.status === 'resolved' && occ?.status === 'maintenance') {
      const other = await db.prepare(`SELECT id FROM maintenance_requests WHERE room_id=? AND id!=? AND status='in_progress'`).bind(roomId, id).first()
      if (!other) await db.prepare(`UPDATE rooms SET status='available' WHERE id=?`).bind(roomId).run()
    }
  }
  await log(db, c.get('user'), 'update', 'maintenance', id, v.status ? `Maintenance "${cur.title}" is now ${v.status.replace('_', ' ')}` : `Updated maintenance "${cur.title}"`)
  return c.json({ ok: true })
})
housekeeping.delete('/maintenance/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM maintenance_requests WHERE id=?').bind(+c.req.param('id')).run()
  return c.json({ ok: true })
})
