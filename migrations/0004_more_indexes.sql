-- Additive, index-only. Cuts D1 rows read. No data changes. Complements 0003_read_indexes.sql (nothing duplicated).
-- Dashboard and reports filter payments and reservations by the day of created_at (expression indexes match date(created_at) exactly).
CREATE INDEX IF NOT EXISTS idx_pay_day ON payments(date(created_at));
CREATE INDEX IF NOT EXISTS idx_res_created_day ON reservations(date(created_at));
-- Lists sorted or filtered by name/status.
CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name);
CREATE INDEX IF NOT EXISTS idx_staff_status_name ON staff(status, name);
CREATE INDEX IF NOT EXISTS idx_staff_dept ON staff(department);
-- Task and request lookups by assignee.
CREATE INDEX IF NOT EXISTS idx_hk_assignee ON housekeeping_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maint_assignee ON maintenance_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_maint_room ON maintenance_requests(room_id);
-- Demo mode on/off touches only flagged rows; partial indexes stay tiny (empty when demo is off).
CREATE INDEX IF NOT EXISTS idx_demo_res ON reservations(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_inv ON invoices(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_items ON invoice_items(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_pay ON payments(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_staff ON staff(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_shifts ON shifts(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_att ON attendance(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_rev ON performance_reviews(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_hk ON housekeeping_tasks(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_maint ON maintenance_requests(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_log ON activity_log(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_rooms ON rooms(id) WHERE is_demo=1;
CREATE INDEX IF NOT EXISTS idx_demo_cats ON room_categories(id) WHERE is_demo=1;
