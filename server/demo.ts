import { newApp, log, getSettings } from './core'
import { HttpError, todayStr, addDays } from './util'

export const demo = newApp()

const TABLES = ['room_categories', 'rooms', 'guests', 'reservations', 'invoices', 'invoice_items', 'payments', 'staff', 'shifts', 'attendance', 'performance_reviews', 'housekeeping_tasks', 'maintenance_requests', 'activity_log']
let seed = 7
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const nights = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const FIRST = ['Ahmed', 'Mohamed', 'Omar', 'Youssef', 'Karim', 'Tarek', 'Khaled', 'Mostafa', 'Fatma', 'Mona', 'Heba', 'Nour', 'Salma', 'Dina', 'Rania', 'Laila', 'Aya', 'Mariam', 'Hala', 'James', 'Emma', 'Lukas', 'Sofia', 'Hans', 'Olga']
const LAST = ['Hassan', 'Ibrahim', 'Mahmoud', 'Farouk', 'Nasser', 'Salem', 'Fahmy', 'Mansour', 'Zaki', 'Shawky', 'Carter', 'Wilson', 'Schneider', 'Rossi', 'Petrov']
const NAT = ['Egypt', 'Egypt', 'Egypt', 'Egypt', 'Saudi Arabia', 'United Arab Emirates', 'United Kingdom', 'Germany', 'Italy', 'Russia', 'France', 'Turkey']
const SOURCES = ['direct', 'phone', 'website', 'website', 'booking_com', 'expedia', 'agency']
const METHODS = ['cash', 'card', 'card', 'bank_transfer', 'mobile_wallet', 'online']
const EXTRAS: [string, string, number][] = [['food', 'Restaurant: dinner', 450], ['food', 'Room service breakfast', 280], ['minibar', 'Minibar', 180], ['laundry', 'Laundry service', 150], ['spa', 'Spa treatment', 900], ['transport', 'Airport transfer', 600]]
const STAFF: [string, string, string][] = [['Hossam Nabil', 'maintenance', 'Technician'], ['Amira Gaber', 'housekeeping', 'Room Attendant'], ['Fatma Ragab', 'housekeeping', 'Room Attendant'], ['Karim Samir', 'front_desk', 'Receptionist'], ['Dalia Farag', 'food_beverage', 'Waitress'], ['Ehab Darwish', 'accounting', 'Cashier'], ['Salwa Hamed', 'housekeeping', 'Room Attendant'], ['Sherif Adel', 'security', 'Security Guard']]

demo.get('/demo', async (c) => {
  const counts: Record<string, number> = {}
  const rows = await c.env.DB.batch(['guests', 'reservations', 'staff', 'rooms'].map((t) => c.env.DB.prepare(`SELECT COUNT(*) n FROM ${t} WHERE is_demo=1`)))
  ;['guests', 'reservations', 'staff', 'rooms'].forEach((t, i) => (counts[t] = (rows[i].results[0] as any).n))
  const s = await getSettings(c.env.DB)
  return c.json({ enabled: !!s.demo_mode, counts })
})

demo.post('/demo/enable', async (c) => {
  const db = c.env.DB
  const s = await getSettings(db)
  const flagged = await db.prepare('SELECT COUNT(*) n FROM guests WHERE is_demo=1').first<{ n: number }>()
  if (s.demo_mode || (flagged?.n ?? 0) > 0) throw new HttpError(409, 'Demo mode is already on')
  seed = 7
  const today = todayStr(); const tax = Number(s.tax_rate ?? 14), svc = Number(s.service_rate ?? 12)
  const st: D1PreparedStatement[] = []
  const P = (sql: string, ...a: any[]) => st.push(db.prepare(sql).bind(...a))

  // rooms: use the real ones; only create demo rooms when the hotel has none
  let { results: rooms } = await db.prepare('SELECT id,price FROM rooms WHERE status!=\'maintenance\'').all<any>()
  if (!rooms.length) {
    P("INSERT INTO room_categories (name,description,base_price,capacity,amenities,is_demo) VALUES ('Demo Deluxe','Demo category',2000,2,'[\"wifi\",\"ac\"]',1)")
    for (let i = 1; i <= 12; i++) P("INSERT INTO rooms (number,floor,category_id,price,capacity,amenities,is_demo) VALUES (?,?,(SELECT id FROM room_categories WHERE name='Demo Deluxe' AND is_demo=1),?,2,'[\"wifi\",\"ac\"]',1)", `D${100 + i}`, 1, 1800 + (i % 4) * 300)
    rooms = Array.from({ length: 12 }, (_, i) => ({ id: -(i + 1), price: 1800 + ((i + 1) % 4) * 300, demoNumber: `D${101 + i}` })) as any
  }
  const roomRef = (r: any) => (r.id < 0 ? '(SELECT id FROM rooms WHERE number=\'' + r.demoNumber + "' AND is_demo=1)" : String(r.id))

  // occupied ranges so demo bookings never collide with real ones
  const { results: busy } = await db.prepare("SELECT room_id,check_in,check_out FROM reservations WHERE status IN ('confirmed','checked_in') AND check_out>?").bind(addDays(today, -75)).all<any>()
  const taken = busy.map((b: any) => [b.room_id, b.check_in, b.check_out])
  const free = (rid: number, a: string, b: string) => !taken.some(([r, x, y]) => r === rid && x < b && y > a)

  // guests
  const G = 26
  for (let i = 1; i <= G; i++) {
    const n = pick(NAT)
    P('INSERT INTO guests (name,email,phone,nationality,id_type,id_number,address,vip,preferences,is_demo) VALUES (?,?,?,?,?,?,?,?,?,1)', `${pick(FIRST)} ${pick(LAST)}`, `demo.guest${i}@demo.example`, `+20 10${ri(10000000, 99999999)}`, n, n === 'Egypt' ? 'national_id' : 'passport', String(ri(100000000, 999999999)), n, i % 7 === 0 ? 1 : 0, i % 4 === 0 ? 'High floor, quiet room' : '')
  }
  // reservations with invoices and payments
  let rc = 0
  for (let k = 0; k < 90; k++) {
    const future = k >= 65
    const len = ri(1, 6)
    const start = future ? addDays(today, ri(1, 40)) : addDays(today, -ri(len, 70))
    const end = addDays(start, len)
    const r: any = pick(rooms)
    if (r.id > 0 && !free(r.id, start, end)) continue
    taken.push([r.id, start, end])
    const status = future ? 'confirmed' : rnd() < 0.1 ? 'cancelled' : 'checked_out'
    const code = `DM-${String(++rc).padStart(4, '0')}`
    const rate = Math.round(r.price), total = rate * len
    const gem = `demo.guest${ri(1, G)}@demo.example`
    P(`INSERT INTO reservations (code,guest_id,room_id,check_in,check_out,adults,children,status,source,rate,nights,total,notes,checked_in_at,checked_out_at,cancelled_at,cancel_reason,created_at,is_demo)
       VALUES (?,(SELECT id FROM guests WHERE email=?),${roomRef(r)},?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`, code, gem, start, end, ri(1, 2), ri(0, 2), status, pick(SOURCES), rate, len, total, '',
      status === 'checked_out' ? `${start} 14:30:00` : null, status === 'checked_out' ? `${end} 11:00:00` : null, status === 'cancelled' ? `${addDays(start, -3)} 10:00:00` : null, status === 'cancelled' ? 'Change of plans' : null, `${addDays(start, -ri(3, 20))} 12:00:00`)
    if (status === 'cancelled') continue
    const inv = `DM-INV-${String(rc).padStart(4, '0')}`
    P('INSERT INTO invoices (number,reservation_id,guest_id,status,tax_rate,service_rate,issued_at,is_demo) VALUES (?,(SELECT id FROM reservations WHERE code=?),(SELECT guest_id FROM reservations WHERE code=?),?,?,?,?,1)', inv, code, code, 'open', tax, svc, `${future ? today : end} 12:00:00`)
    const iid = '(SELECT id FROM invoices WHERE number=\'' + inv + "')"
    P(`INSERT INTO invoice_items (invoice_id,type,description,quantity,unit_price,is_demo) VALUES (${iid},'room',?,?,?,1)`, `Room stay (${len} nights)`, len, rate)
    let sub = total
    if (!future && rnd() < 0.6) { const e = pick(EXTRAS); sub += e[2]; P(`INSERT INTO invoice_items (invoice_id,type,description,quantity,unit_price,is_demo) VALUES (${iid},?,?,1,?,1)`, e[0], e[1], e[2]) }
    const gross = Math.round(sub * (1 + svc / 100) * (1 + tax / 100))
    const pay = future ? Math.round(gross * 0.3) : rnd() < 0.85 ? gross : Math.round(gross * 0.5)
    if (pay > 0) P(`INSERT INTO payments (invoice_id,amount,method,kind,created_at,is_demo) VALUES (${iid},?,?,'payment',?,1)`, pay, pick(METHODS), `${future ? today : end} 11:30:00`)
  }
  // staff, shifts, attendance, reviews
  const sc = (i: number) => `demo.staff${i}@demo.example`
  STAFF.forEach(([name, department, position], i) => P("INSERT INTO staff (name,department,position,email,phone,hire_date,salary,status,is_demo) VALUES (?,?,?,?,?,?,?,'active',1)", name, department, position, sc(i), `+20 11${ri(10000000, 99999999)}`, addDays(today, -ri(200, 1500)), ri(6, 18) * 1000))
  STAFF.forEach((_, i) => {
    for (let d = -3; d <= 6; d++) { const sh = pick(['morning', 'evening', 'night']); const T: any = { morning: ['07:00', '15:00'], evening: ['15:00', '23:00'], night: ['23:00', '07:00'] }; P('INSERT INTO shifts (staff_id,date,shift,start_time,end_time,is_demo) VALUES ((SELECT id FROM staff WHERE email=?),?,?,?,?,1)', sc(i), addDays(today, d), sh, T[sh][0], T[sh][1]) }
    for (let d = -6; d <= 0; d++) P('INSERT INTO attendance (staff_id,date,check_in,check_out,status,is_demo) VALUES ((SELECT id FROM staff WHERE email=?),?,?,?,?,1)', sc(i), addDays(today, d), '07:0' + ri(0, 9), d < 0 ? '15:0' + ri(0, 9) : null, rnd() < 0.1 ? 'late' : 'present')
    P("INSERT INTO performance_reviews (staff_id,period,score,notes,is_demo) VALUES ((SELECT id FROM staff WHERE email=?),?,?,'Reliable and punctual',1)", sc(i), today.slice(0, 7), Math.round((3 + rnd() * 2) * 10) / 10)
  })
  // housekeeping and maintenance on real rooms
  for (let i = 0; i < 12; i++) {
    const r: any = pick(rooms); const status = pick(['pending', 'in_progress', 'completed', 'completed'])
    P(`INSERT INTO housekeeping_tasks (room_id,type,assigned_to,status,priority,scheduled_for,notes,is_demo) VALUES (${roomRef(r)},?,(SELECT id FROM staff WHERE email=?),?,?,?,'',1)`, pick(['cleaning', 'checkout_cleaning', 'deep_cleaning', 'turndown']), sc(pick([1, 2, 6])), status, pick(['normal', 'normal', 'high']), today)
  }
  for (const [title, p] of [['Air conditioner not cooling', 'high'], ['Leaking tap in bathroom', 'normal'], ['Replace bedside lamp', 'low']] as const) P(`INSERT INTO maintenance_requests (room_id,title,description,priority,status,assigned_to,is_demo) VALUES (${roomRef(pick(rooms) as any)},?, '',?,'open',(SELECT id FROM staff WHERE email=?),1)`, title, p, sc(0))
  for (const m of ['Demo data loaded', 'Payment received', 'Room marked clean', 'New reservation']) P("INSERT INTO activity_log (user_name,action,entity,message,is_demo) VALUES ('Demo','create','demo',?,1)", m)
  P("INSERT INTO settings (key,value) VALUES ('demo_mode','true') ON CONFLICT(key) DO UPDATE SET value='true'")
  await db.batch(st)
  await log(db, c.get('user'), 'create', 'demo', null, 'Demo mode turned on')
  return c.json({ ok: true, statements: st.length })
})

demo.post('/demo/disable', async (c) => {
  const db = c.env.DB
  const st: D1PreparedStatement[] = []
  const Q = (sql: string) => st.push(db.prepare(sql))
  // anything real that points at a demo row adopts it, so real data is never deleted or orphaned
  Q("UPDATE guests SET is_demo=0 WHERE is_demo=1 AND (id IN (SELECT guest_id FROM reservations WHERE is_demo=0) OR id IN (SELECT guest_id FROM invoices WHERE is_demo=0))")
  Q("UPDATE rooms SET is_demo=0 WHERE is_demo=1 AND (id IN (SELECT room_id FROM reservations WHERE is_demo=0) OR id IN (SELECT room_id FROM housekeeping_tasks WHERE is_demo=0) OR id IN (SELECT room_id FROM maintenance_requests WHERE is_demo=0 AND room_id IS NOT NULL))")
  Q("UPDATE room_categories SET is_demo=0 WHERE is_demo=1 AND id IN (SELECT category_id FROM rooms WHERE is_demo=0)")
  Q("UPDATE staff SET is_demo=0 WHERE is_demo=1 AND (id IN (SELECT assigned_to FROM housekeeping_tasks WHERE is_demo=0 AND assigned_to IS NOT NULL) OR id IN (SELECT assigned_to FROM maintenance_requests WHERE is_demo=0 AND assigned_to IS NOT NULL) OR id IN (SELECT staff_id FROM shifts WHERE is_demo=0) OR id IN (SELECT staff_id FROM attendance WHERE is_demo=0) OR id IN (SELECT staff_id FROM performance_reviews WHERE is_demo=0))")
  Q("UPDATE reservations SET is_demo=0 WHERE is_demo=1 AND id IN (SELECT reservation_id FROM invoices WHERE is_demo=0 AND reservation_id IS NOT NULL)")
  for (const t of ['payments', 'invoice_items', 'invoices', 'performance_reviews', 'attendance', 'shifts', 'housekeeping_tasks', 'maintenance_requests', 'reservations', 'activity_log', 'guests', 'staff', 'rooms', 'room_categories']) Q(`DELETE FROM ${t} WHERE is_demo=1`)
  Q("INSERT INTO settings (key,value) VALUES ('demo_mode','false') ON CONFLICT(key) DO UPDATE SET value='false'")
  await db.batch(st)
  await log(db, c.get('user'), 'delete', 'demo', null, 'Demo mode turned off, demo data removed')
  return c.json({ ok: true })
})
void TABLES
