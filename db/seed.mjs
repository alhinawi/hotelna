// Generates db/seed.sql with realistic, internally consistent demo data (relative to today, Cairo time).
// Usage: node db/seed.mjs > db/seed.sql
import { webcrypto as crypto } from 'node:crypto'

let s = 20261118
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const round2 = (n) => Math.round(n * 100) / 100
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
const add = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const diff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

async function hash(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const b64 = (b) => Buffer.from(b).toString('base64url')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256)
  return `100000$${b64(salt)}$${b64(new Uint8Array(bits))}`
}

const out = []
const ins = (table, row) => out.push(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(q).join(',')});`)

const settings = {
  hotel_name: 'Hotelna Grand Hotel', hotel_address: '14 El Gomhoureya Street, Mansoura, Dakahlia, Egypt', hotel_phone: '+20 50 222 4400', hotel_email: 'info@hotelna.example',
  checkin_time: '14:00', checkout_time: '12:00', currency: 'EGP', currency_symbol: 'EGP', tax_rate: 14, service_rate: 12, weekend_markup: 15, default_language: 'en', timezone: 'Africa/Cairo', star_rating: 5,
}
for (const [k, v] of Object.entries(settings)) ins('settings', { key: k, value: JSON.stringify(v) })

const cats = [
  ['Single Room', 'Compact, quiet room with a single bed and a work desk.', 1800, 1, ['WiFi', 'AC', 'TV', 'Work desk'], '/img/single.jpg'],
  ['Standard Twin', 'Two twin beds, ideal for friends or colleagues.', 2500, 2, ['WiFi', 'AC', 'TV', 'Minibar'], '/img/standard.jpg'],
  ['Deluxe King', 'King bed, city view and a marble bathroom.', 3400, 2, ['WiFi', 'AC', 'TV', 'Minibar', 'Bathtub', 'City view'], '/img/deluxe.jpg'],
  ['Family Room', 'Large room with a king bed and extra beds for children.', 4200, 4, ['WiFi', 'AC', 'TV', 'Minibar', 'Extra beds', 'Balcony'], '/img/family.jpg'],
  ['Junior Suite', 'Bedroom with a separate seating area.', 5200, 3, ['WiFi', 'AC', 'Smart TV', 'Minibar', 'Lounge', 'Nile view'], '/img/suite.jpg'],
  ['Executive Suite', 'Wood-panelled suite with a study and premium amenities.', 6800, 3, ['WiFi', 'AC', 'Smart TV', 'Minibar', 'Study', 'Nile view', 'Bathtub'], '/img/executive.jpg'],
  ['Presidential Suite', 'Our largest suite: two rooms, a dining area and butler service.', 12000, 4, ['WiFi', 'AC', 'Smart TV', 'Minibar', 'Butler', 'Dining area', 'Nile view', 'Jacuzzi'], '/img/presidential.jpg'],
]
cats.forEach((c, i) => ins('room_categories', { name: c[0], description: c[1], base_price: c[2], capacity: c[3], amenities: JSON.stringify(c[4]), image: c[5] }))

// 5 floors x 8 rooms
const layout = { 1: [1, 1, 1, 1, 2, 2, 2, 2], 2: [2, 2, 2, 2, 3, 3, 3, 3], 3: [3, 3, 3, 3, 4, 4, 4, 4], 4: [5, 5, 5, 5, 4, 4, 5, 5], 5: [6, 6, 6, 6, 5, 5, 6, 7] }
const rooms = []
for (const f of [1, 2, 3, 4, 5]) layout[f].forEach((cat, i) => {
  const c = cats[cat - 1]
  rooms.push({ id: rooms.length + 1, number: `${f}0${i + 1}`, floor: f, cat, price: c[2], capacity: c[3], amenities: c[4], image: c[5] })
})
const maintenanceRooms = new Set([rooms[10].id, rooms[27].id])

const firstM = ['Ahmed', 'Mohamed', 'Mahmoud', 'Omar', 'Youssef', 'Karim', 'Hassan', 'Tarek', 'Khaled', 'Amr', 'Mostafa', 'Ibrahim', 'Sherif', 'Hossam', 'Walid']
const firstF = ['Fatma', 'Mona', 'Heba', 'Nour', 'Salma', 'Dina', 'Rania', 'Yasmin', 'Laila', 'Aya', 'Mariam', 'Hala', 'Noha']
const lastN = ['Hassan', 'Ibrahim', 'Mahmoud', 'El-Sayed', 'Abdelrahman', 'Farouk', 'Nasser', 'Salem', 'Fahmy', 'Mansour', 'Gaber', 'Zaki', 'Shawky', 'Badawi', 'Helmy']
const intl = [['James Carter', 'United Kingdom', 'passport'], ['Emma Wilson', 'United Kingdom', 'passport'], ['Lukas Schneider', 'Germany', 'passport'], ['Anna Fischer', 'Germany', 'passport'], ['Marco Rossi', 'Italy', 'passport'], ['Sofia Romano', 'Italy', 'passport'], ['Pierre Dubois', 'France', 'passport'], ['Claire Martin', 'France', 'passport'], ['Ivan Petrov', 'Russia', 'passport'], ['Olga Smirnova', 'Russia', 'passport'], ['Michael Brown', 'United States', 'passport'], ['Sarah Johnson', 'United States', 'passport'], ['Faisal Al-Harbi', 'Saudi Arabia', 'passport'], ['Noura Al-Saud', 'Saudi Arabia', 'passport'], ['Khalid Al-Mansoori', 'United Arab Emirates', 'passport'], ['Mehmet Yilmaz', 'Turkey', 'passport'], ['Ayse Demir', 'Turkey', 'passport'], ['Jan de Vries', 'Netherlands', 'passport'], ['Yuki Tanaka', 'Japan', 'passport'], ['Li Wei', 'China', 'passport']]
const guests = []
for (let i = 0; i < 52; i++) {
  const female = rnd() < 0.4
  const name = `${pick(female ? firstF : firstM)} ${pick(lastN)}`
  guests.push({ name, nationality: 'Egypt', id_type: 'national_id', id_number: `29${ri(10, 99)}${ri(10, 12)}${ri(10, 28)}${ri(1000000, 9999999)}`.slice(0, 14) })
}
for (const [name, nat, idt] of intl) guests.push({ name, nationality: nat, id_type: idt, id_number: `${pick(['A', 'P', 'X', 'C'])}${ri(1000000, 9999999)}` })
guests.forEach((g, i) => {
  const email = g.name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '.') + '@example.com'
  g.id = i + 1; g.vip = rnd() < 0.12 ? 1 : 0
  ins('guests', { name: g.name, email, phone: g.nationality === 'Egypt' ? `+2010${ri(10000000, 99999999)}` : `+${ri(30, 49)}${ri(100000000, 999999999)}`, nationality: g.nationality, id_type: g.id_type, id_number: g.id_number, id_document: null, address: g.nationality === 'Egypt' ? pick(['Mansoura', 'Cairo', 'Alexandria', 'Tanta', 'Damietta', 'Giza']) + ', Egypt' : g.nationality, vip: g.vip, preferences: g.vip ? pick(['High floor, feather-free pillows', 'Quiet room away from the elevator', 'Late check-out, sparkling water on arrival']) : pick(['', '', 'Non-smoking room', 'Extra towels', 'Early check-in when possible']), notes: g.vip ? 'VIP guest' : '', created_at: add(today, -ri(5, 120)) + ' 10:00:00' })
})

const roomEn = new Map(rooms.map((r) => [r.id, r]))
const sources = ['direct', 'direct', 'phone', 'website', 'website', 'booking_com', 'booking_com', 'expedia', 'agency']
const methods = ['cash', 'card', 'card', 'bank_transfer', 'mobile_wallet', 'online']
const extras = [['food', 'Restaurant: dinner', 450], ['food', 'Room service breakfast', 280], ['minibar', 'Minibar', 180], ['laundry', 'Laundry service', 220], ['spa', 'Spa massage 60 min', 900], ['transport', 'Airport transfer', 600], ['service', 'Late check-out', 500]]
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay()
const nightRate = (rate, d) => rate * (dow(d) === 5 || dow(d) === 6 ? 1.15 : 1)

const res = []; let resId = 0, invId = 0
const hkTasks = []
function addReservation(r, status, opts = {}) {
  resId++; invId++
  const g = pick(guests)
  const nights = diff(r.ci, r.co)
  let total = 0; for (let d = r.ci; d < r.co; d = add(d, 1)) total += nightRate(r.room.price, d); total = round2(total)
  const code = 'RS-' + (1000 + resId * 7).toString(36).toUpperCase().padStart(4, '0') + String.fromCharCode(65 + (resId % 26))
  const created = add(r.ci, -ri(1, 28))
  const adults = Math.min(r.room.capacity, ri(1, 2)), children = r.room.capacity > 2 && rnd() < 0.4 ? ri(1, r.room.capacity - 2) : 0
  const walk = opts.walk ? 1 : 0
  ins('reservations', { code, guest_id: g.id, room_id: r.room.id, check_in: r.ci, check_out: r.co, adults, children, status, source: walk ? 'walk_in' : pick(sources), rate: r.room.price, nights, total, walk_in: walk, notes: '', checked_in_at: ['checked_in', 'checked_out'].includes(status) ? r.ci + ' 14:' + String(ri(10, 59)) + ':00' : null, checked_out_at: status === 'checked_out' ? r.co + ' 11:' + String(ri(10, 59)) + ':00' : null, cancelled_at: ['cancelled', 'no_show'].includes(status) ? add(r.ci, -ri(1, 6)) + ' 12:00:00' : null, cancel_reason: status === 'cancelled' ? pick(['Change of plans', 'Found a cheaper option', 'Travel cancelled']) : status === 'no_show' ? 'Guest did not arrive' : null, refund_amount: 0, created_by: 3, created_at: created + ' 09:' + String(ri(10, 59)) + ':00' })
  // invoice
  const items = [{ type: 'room', description: `Room ${r.room.number} (${nights} night${nights > 1 ? 's' : ''})`, quantity: nights, unit_price: round2(total / nights) }]
  if (['checked_in', 'checked_out'].includes(status)) for (let k = 0, n = ri(0, 3); k < n; k++) { const e = pick(extras); items.push({ type: e[0], description: e[1], quantity: ri(1, 2), unit_price: e[2] }) }
  const subtotal = items.reduce((a, i) => a + i.quantity * i.unit_price, 0)
  const discount = g.vip && status !== 'confirmed' ? round2(subtotal * 0.05) : 0
  const net = subtotal - discount, service = round2(net * 0.12), tax = round2((net + service) * 0.14), grand = round2(net + service + tax)
  ins('invoices', { number: `INV-${today.slice(0, 4)}-${String(invId).padStart(4, '0')}`, reservation_id: resId, guest_id: g.id, status: ['cancelled', 'no_show'].includes(status) ? 'void' : 'open', discount, tax_rate: 14, service_rate: 12, notes: '', issued_at: created + ' 09:30:00' })
  for (const it of items) ins('invoice_items', { invoice_id: invId, ...it, created_at: r.ci + ' 15:00:00' })
  const pay = (amount, when, kind = 'payment', ref = null) => ins('payments', { invoice_id: invId, amount: round2(amount), method: pick(methods), kind, reference: ref, created_by: pick([3, 3, 5]), created_at: when })
  if (status === 'checked_out') { if (rnd() < 0.25) { const d = round2(grand * 0.4); pay(d, r.ci + ' 14:30:00'); pay(grand - d, r.co + ' 11:30:00') } else pay(grand, r.co + ' 11:30:00') }
  else if (status === 'checked_in') { if (rnd() < 0.35) pay(grand, r.ci + ' 14:40:00'); else pay(Math.min(grand, round2(total * 0.5)), r.ci + ' 14:40:00') }
  else if (status === 'confirmed' && rnd() < 0.55) pay(round2(grand * 0.3), created + ' 09:40:00', 'payment', 'Deposit')
  else if (status === 'cancelled' && rnd() < 0.5) { const dep = round2(grand * 0.3); pay(dep, created + ' 09:40:00', 'payment', 'Deposit'); pay(dep / 2, add(r.ci, -2) + ' 12:00:00', 'refund', `Cancellation ${code}`) }
  res.push({ roomId: r.room.id, status })
}

for (const room of rooms) {
  let d = add(today, -80 + ri(0, 4))
  const maint = maintenanceRooms.has(room.id)
  while (d < add(today, 38)) {
    const nights = ri(1, 6); const ci = d, co = add(d, nights)
    d = add(co, ri(0, 2))
    if (maint && co > today) break
    let status
    if (co < today) status = rnd() < 0.93 ? 'checked_out' : pick(['cancelled', 'no_show'])
    else if (ci > today) status = 'confirmed'
    else if (co === today) status = rnd() < 0.5 ? 'checked_out' : 'checked_in'
    else status = ci === today && rnd() < 0.3 ? 'confirmed' : 'checked_in'
    if (status === 'cancelled' || status === 'no_show') { addReservation({ room, ci, co }, status); continue }
    if (ci > today && rnd() < 0.18) { d = ci; continue } // leave some future gaps
    addReservation({ room, ci, co }, status, { walk: status !== 'confirmed' && ci === today && rnd() < 0.3 })
    room.last = { status, co }
  }
  // a few extra cancelled bookings on top of free periods
  if (rnd() < 0.25) addReservation({ room, ci: add(today, ri(5, 25)), co: add(today, ri(26, 30)) }, 'cancelled')
}
// room statuses
const ci = new Map(res.filter((r) => r.status === 'checked_in').map((r) => [r.roomId, 1]))
let dirtyCount = 0
for (const room of rooms) {
  let status = ci.has(room.id) ? 'occupied' : maintenanceRooms.has(room.id) ? 'maintenance' : 'available'
  let hk = 'clean'
  if (status === 'available' && room.last && room.last.status === 'checked_out' && room.last.co === today) { hk = 'dirty'; dirtyCount++ }
  if (room.id === rooms[4].id && status === 'available') hk = 'cleaning'
  else if (status === 'available' && hk === 'clean' && dirtyCount < 4 && room.id % 5 === 2) { hk = 'dirty'; dirtyCount++ }
  ins('rooms', { number: room.number, floor: room.floor, category_id: room.cat, price: room.price, capacity: room.capacity, amenities: JSON.stringify(room.amenities), status, housekeeping_status: hk, image: room.image, notes: '' })
  room.hk = hk; room.rstatus = status
}

// staff
const staff = [
  ['Mohamed Alhinawi', 'management', 'General Manager', 52000], ['Sara Mostafa', 'management', 'Operations Manager', 38000],
  ['Ahmed Fathy', 'front_desk', 'Front Desk Supervisor', 16000], ['Nour El-Din', 'front_desk', 'Receptionist', 12000], ['Mona Adel', 'front_desk', 'Receptionist', 12000], ['Karim Samir', 'front_desk', 'Night Auditor', 13000],
  ['Hanan Saeed', 'housekeeping', 'Head Housekeeper', 15000], ['Fatma Ragab', 'housekeeping', 'Room Attendant', 8500], ['Amira Gaber', 'housekeeping', 'Room Attendant', 8500], ['Salwa Hamed', 'housekeeping', 'Room Attendant', 8500], ['Eman Zaki', 'housekeeping', 'Room Attendant', 8500], ['Reda Mahmoud', 'housekeeping', 'Laundry Attendant', 8000],
  ['Hossam Nabil', 'maintenance', 'Chief Engineer', 18000], ['Tamer Younis', 'maintenance', 'Technician', 11000], ['Wael Sobhy', 'maintenance', 'Electrician', 11000],
  ['Yasser Kamel', 'food_beverage', 'Restaurant Manager', 17000], ['Hesham Awad', 'food_beverage', 'Chef', 15000], ['Dalia Farag', 'food_beverage', 'Waitress', 8000],
  ['Said Morsy', 'security', 'Security Supervisor', 12000], ['Adel Shaker', 'security', 'Security Guard', 8500],
  ['Rasha Lotfy', 'accounting', 'Accountant', 16000], ['Ehab Darwish', 'accounting', 'Cashier', 11000],
]
staff.forEach((s, i) => ins('staff', { name: s[0], department: s[1], position: s[2], email: s[0].toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '.') + '@hotelna.example', phone: `+2012${ri(10000000, 99999999)}`, hire_date: add(today, -ri(60, 1800)), salary: s[3], status: i === 9 ? 'on_leave' : 'active', photo: null }))

// users: 1 admin (GM), 2 manager, 3 front desk, 4 housekeeping, 5 accountant
const pwds = { admin: 'Admin@123', manager: 'Manager@123', frontdesk: 'Front@12345', housekeeping: 'House@12345', accountant: 'Account@123' }
const users = [['Mohamed Alhinawi', 'admin@hotelna.example', 'admin', 'admin', 1], ['Sara Mostafa', 'manager@hotelna.example', 'manager', 'manager', 2], ['Ahmed Fathy', 'frontdesk@hotelna.example', 'front_desk', 'frontdesk', 3], ['Hanan Saeed', 'housekeeping@hotelna.example', 'housekeeping', 'housekeeping', 7], ['Rasha Lotfy', 'accountant@hotelna.example', 'accountant', 'accountant', 21]]
for (const u of users) ins('users', { name: u[0], email: u[1], password_hash: await hash(pwds[u[3]]), role: u[2], staff_id: u[4], active: 1, avatar: null })

// shifts (14 days back, 7 forward) for front desk/housekeeping/security/maintenance/F&B
const shiftTimes = { morning: ['07:00', '15:00'], evening: ['15:00', '23:00'], night: ['23:00', '07:00'] }
for (let i = 0; i < staff.length; i++) {
  if (['management', 'accounting'].includes(staff[i][1])) continue
  for (let k = -10; k <= 7; k++) {
    if ((k + i) % 7 === 0) continue // day off
    const sh = ['morning', 'morning', 'evening', 'night'][(i + Math.floor((k + 14) / 7)) % 4]
    const d = add(today, k)
    ins('shifts', { staff_id: i + 1, date: d, shift: sh, start_time: shiftTimes[sh][0], end_time: shiftTimes[sh][1] })
    if (k < 0 || (k === 0 && sh === 'morning')) {
      const absent = rnd() < 0.05, late = rnd() < 0.1
      const [h] = shiftTimes[sh][0].split(':').map(Number)
      const inT = `${String(h).padStart(2, '0')}:${late ? ri(10, 40) : ri(0, 5) + '0'.slice(0, 0)}`
      ins('attendance', { staff_id: i + 1, date: d, check_in: absent ? null : `${String(h).padStart(2, '0')}:${String(late ? ri(10, 40) : ri(0, 9)).padStart(2, '0')}`, check_out: absent || k === 0 ? null : `${String((h + 8) % 24).padStart(2, '0')}:${String(ri(0, 20)).padStart(2, '0')}`, status: absent ? 'absent' : late ? 'late' : 'present' })
    }
  }
}
for (let i = 0; i < staff.length; i++) for (const period of ['2026-Q2', '2026-Q3']) ins('performance_reviews', { staff_id: i + 1, period, score: round2(3 + rnd() * 2).toFixed(1) * 1, notes: pick(['Reliable and punctual.', 'Great guest feedback.', 'Needs improvement on speed.', 'Takes initiative, helps the team.', 'Consistent quality.']), created_at: add(today, period === '2026-Q3' ? -40 : -130) + ' 09:00:00' })

// housekeeping tasks: dirty/cleaning rooms + today's schedule
const attendants = [8, 9, 10, 11]
for (const room of rooms) {
  if (room.hk === 'dirty') hkTasks.push({ room_id: room.id, type: 'checkout_cleaning', assigned_to: pick(attendants), status: 'pending', priority: 'high', notes: 'Checkout cleaning' })
  if (room.hk === 'cleaning') hkTasks.push({ room_id: room.id, type: 'cleaning', assigned_to: 8, status: 'in_progress', priority: 'normal', notes: 'Deep clean after repainting' })
}
for (const room of rooms.filter((r) => r.rstatus === 'occupied').slice(0, 8)) hkTasks.push({ room_id: room.id, type: pick(['cleaning', 'turndown']), assigned_to: pick(attendants), status: pick(['pending', 'completed', 'completed', 'in_progress']), priority: 'normal', notes: 'Daily service' })
for (const room of rooms.slice(0, 6)) hkTasks.push({ room_id: room.id, type: 'cleaning', assigned_to: pick(attendants), status: 'completed', priority: 'low', notes: 'Daily clean', date: add(today, -1) })
for (const t of hkTasks) ins('housekeeping_tasks', { room_id: t.room_id, type: t.type, assigned_to: t.assigned_to, status: t.status, priority: t.priority, scheduled_for: t.date ?? today, notes: t.notes, started_at: ['in_progress', 'completed'].includes(t.status) ? (t.date ?? today) + ' 09:10:00' : null, completed_at: t.status === 'completed' ? (t.date ?? today) + ' 10:05:00' : null, created_at: (t.date ?? today) + ' 07:00:00' })

const mt = [
  [rooms[10].id, 'AC compressor failure', 'Compressor noisy then stopped. Room closed until replaced.', 'urgent', 'in_progress', 13], [rooms[27].id, 'Water leak under bathroom sink', 'Pipe replaced, waiting for floor to dry.', 'high', 'in_progress', 14],
  [rooms[3].id, 'TV remote not working', '', 'low', 'open', 14], [rooms[20].id, 'Bedside lamp flickers', 'Replace bulb and check socket.', 'normal', 'open', 15], [null, 'Lobby elevator slow to respond', 'Call elevator contractor.', 'high', 'open', 13], [rooms[15].id, 'Door lock battery low', '', 'normal', 'resolved', 15],
]
mt.forEach((m, i) => ins('maintenance_requests', { room_id: m[0], title: m[1], description: m[2], priority: m[3], status: m[4], reported_by: 4, assigned_to: m[5], created_at: add(today, -i - 1) + ' 11:00:00', resolved_at: m[4] === 'resolved' ? add(today, -1) + ' 16:00:00' : null }))

const acts = ['Checked in', 'Checked out', 'New reservation', 'Payment received', 'Room marked clean']
for (let i = 0; i < 6; i++) ins('activity_log', { ts: add(today, -1) + ` ${String(10 + i * 2)}:15:00`, user_id: 3, user_name: 'Ahmed Fathy', action: 'update', entity: 'system', entity_id: null, message: `${pick(acts)}: room ${pick(rooms).number}` })
ins('activity_log', { ts: today + ' 06:30:00', user_id: null, user_name: 'System', action: 'create', entity: 'system', entity_id: null, message: 'Demo data loaded' })

console.log('-- generated by db/seed.mjs')
const ORDER = ['settings','room_categories','rooms','guests','staff','users','reservations','invoices','invoice_items','payments','shifts','attendance','performance_reviews','housekeeping_tasks','maintenance_requests','activity_log']
const tbl = (l) => l.split(' ')[2]
console.log(out.map((l, i) => [ORDER.indexOf(tbl(l)), i, l]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]).join('\n'))
console.error(`reservations=${resId} dirty=${dirtyCount}`)
