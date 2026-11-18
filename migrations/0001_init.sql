CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'front_desk',
  staff_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE room_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  base_price REAL NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 2,
  amenities TEXT DEFAULT '[]',
  image TEXT
);
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  floor INTEGER NOT NULL DEFAULT 1,
  category_id INTEGER NOT NULL REFERENCES room_categories(id),
  price REAL NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 2,
  amenities TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'available',
  housekeeping_status TEXT NOT NULL DEFAULT 'clean',
  image TEXT,
  notes TEXT DEFAULT ''
);
CREATE TABLE guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  id_type TEXT DEFAULT 'passport',
  id_number TEXT,
  id_document TEXT,
  address TEXT,
  vip INTEGER NOT NULL DEFAULT 0,
  preferences TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL DEFAULT 'direct',
  rate REAL NOT NULL DEFAULT 0,
  nights INTEGER NOT NULL DEFAULT 1,
  total REAL NOT NULL DEFAULT 0,
  walk_in INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  checked_in_at TEXT,
  checked_out_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT,
  refund_amount REAL NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_res_room ON reservations(room_id, check_in, check_out);
CREATE INDEX idx_res_guest ON reservations(guest_id);
CREATE INDEX idx_res_status ON reservations(status);
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  reservation_id INTEGER REFERENCES reservations(id),
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  status TEXT NOT NULL DEFAULT 'open',
  discount REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  service_rate REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'service',
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  kind TEXT NOT NULL DEFAULT 'payment',
  reference TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'front_desk',
  position TEXT DEFAULT '',
  email TEXT,
  phone TEXT,
  hire_date TEXT,
  salary REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  photo TEXT
);
CREATE TABLE shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'morning',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT NOT NULL DEFAULT 'present',
  UNIQUE(staff_id, date)
);
CREATE TABLE performance_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  score REAL NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE housekeeping_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  type TEXT NOT NULL DEFAULT 'cleaning',
  assigned_to INTEGER REFERENCES staff(id),
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  scheduled_for TEXT NOT NULL,
  notes TEXT DEFAULT '',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE maintenance_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER REFERENCES rooms(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  reported_by INTEGER,
  assigned_to INTEGER REFERENCES staff(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  user_id INTEGER,
  user_name TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  message TEXT NOT NULL
);
