-- Indexes for every lookup that was scanning a table (cuts D1 rows read; the free plan has a daily row-read cap).
CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pay_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_guest ON invoices(guest_id);
CREATE INDEX IF NOT EXISTS idx_inv_res ON invoices(reservation_id);
CREATE INDEX IF NOT EXISTS idx_inv_issued ON invoices(issued_at);
CREATE INDEX IF NOT EXISTS idx_res_checkin ON reservations(check_in);
CREATE INDEX IF NOT EXISTS idx_res_checkout ON reservations(check_out);
CREATE INDEX IF NOT EXISTS idx_hk_sched ON housekeeping_tasks(scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_hk_room ON housekeeping_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_shift_date ON shifts(date, staff_id);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_rev_staff ON performance_reviews(staff_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status, housekeeping_status);
CREATE INDEX IF NOT EXISTS idx_rooms_cat ON rooms(category_id);
CREATE INDEX IF NOT EXISTS idx_guests_demo ON guests(is_demo);
