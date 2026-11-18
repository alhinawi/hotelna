import { useState } from 'react'
import { Plus, Star, LogIn, LogOut, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { api, qs, useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { addDaysISO, fmtShort, fmtWeekday, todayISO } from '@/lib/format'
import { Badge, Button, Card, DataTable, ErrorState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Tabs, Textarea, cx, errMsg, fieldErrors, useToast } from '@/components/ui'

const DEPTS = ['front_desk', 'housekeeping', 'maintenance', 'food_beverage', 'management', 'security', 'accounting']
const SHIFTS = ['morning', 'evening', 'night']
const SHIFT_TONE: Record<string, string> = { morning: 'bg-amber-100 text-amber-800', evening: 'bg-sky-100 text-sky-800', night: 'bg-ink-800 text-white' }

export default function Staff() {
  const { t } = useI18n(); const { can } = useAuth(); const w = can('staff', 'write')
  const [tab, setTab] = useState<'emp' | 'shifts' | 'att'>('emp'); const [form, setForm] = useState<any>(null); const [tick, setTick] = useState(0)
  return (
    <div>
      <PageHeader title={t('staff.title')} subtitle={t('staff.subtitle')} actions={w && tab === 'emp' && <Button variant="primary" onClick={() => setForm({})}><Plus className="size-4" />{t('staff.add')}</Button>} />
      <Tabs tabs={[{ id: 'emp', label: t('staff.employees') }, { id: 'shifts', label: t('staff.shifts') }, { id: 'att', label: t('staff.attendance') }]} value={tab} onChange={setTab} />
      {tab === 'emp' ? <Employees key={tick} w={w} onEdit={setForm} /> : tab === 'shifts' ? <Shifts w={w} /> : <Attendance w={w} />}
      {form && <EmpForm emp={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); setTick((x) => x + 1) }} />}
    </div>
  )
}

function Employees({ w, onEdit }: { w: boolean; onEdit: (e: any) => void }) {
  const { t, money, date } = useI18n()
  const [f, setF] = useState({ q: '', department: '', page: 1, sort: 'name', dir: 'asc' }); const [open, setOpen] = useState<number | null>(null)
  const { data, error, loading, reload } = useApi<any>('/staff' + qs({ ...f, pageSize: 12 }))
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
        <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v, page: 1 })} />
        <Select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value, page: 1 })} className="w-52"><option value="">{t('staff.department')}: {t('common.all')}</option>{DEPTS.map((d) => <option key={d} value={d}>{t('dept.' + d)}</option>)}</Select>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (<>
        <DataTable<any> rows={data.data} sort={f.sort} dir={f.dir as any} onSort={(s) => setF((x) => ({ ...x, sort: s, dir: x.sort === s && x.dir === 'asc' ? 'desc' : 'asc' }))} onRow={(r) => setOpen(r.id)} cols={[
          { key: 'name', header: t('common.name'), sort: 'name', render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
          { key: 'dept', header: t('staff.department'), sort: 'department', render: (r) => t('dept.' + r.department) },
          { key: 'pos', header: t('staff.position'), sort: 'position', render: (r) => r.position, hideOnMobile: true },
          { key: 'hire', header: t('staff.hired'), sort: 'hire_date', render: (r) => <span className="tabular-nums">{date(r.hire_date)}</span>, hideOnMobile: true },
          { key: 'score', header: t('staff.performance'), sort: 'avg_score', render: (r) => r.avg_score ? <span className="num flex items-center gap-1"><Star className="size-3 fill-gold-500 text-gold-500" />{Number(r.avg_score).toFixed(1)}</span> : '—' },
          { key: 'status', header: t('common.status'), sort: 'status', render: (r) => <StatusBadge status={r.status} /> },
        ]} />
        <Pagination page={f.page} pageSize={12} total={data.total} onPage={(p) => setF((x) => ({ ...x, page: p }))} />
      </>)}
      {open !== null && <Profile id={open} w={w} money={money} onClose={() => { setOpen(null); reload() }} onEdit={(e) => { setOpen(null); onEdit(e) }} />}
    </Card>
  )
}

function Profile({ id, w, onClose, onEdit, money }: { id: number; w: boolean; onClose: () => void; onEdit: (e: any) => void; money: (n: number) => string }) {
  const { t, date } = useI18n(); const toast = useToast()
  const { data: e, reload, error } = useApi<any>('/staff/' + id)
  const [r, setR] = useState({ period: new Date().toISOString().slice(0, 7), score: '4', notes: '' })
  const add = async () => { try { await api(`/staff/${id}/reviews`, { body: { period: r.period, score: Number(r.score), notes: r.notes } }); toast(t('common.saved')); setR({ ...r, notes: '' }); reload() } catch (x) { toast(errMsg(x), 'err') } }
  return (
    <Modal open onClose={onClose} size="lg" title={e?.name ?? '...'} footer={e && w ? <Button onClick={() => onEdit(e)}><Pencil className="size-4" />{t('common.edit')}</Button> : undefined}>
      {error ? <ErrorState error={error} /> : !e ? <Loading /> : (
        <div className="grid gap-6 md:grid-cols-2 text-sm">
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-ink-500">{t('staff.department')}</dt><dd className="font-medium">{t('dept.' + e.department)}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('staff.position')}</dt><dd className="font-medium">{e.position}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('common.phone')}</dt><dd className="num font-medium">{e.phone || '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('common.email')}</dt><dd className="break-all font-medium">{e.email || '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('staff.hired')}</dt><dd className="tabular-nums font-medium">{date(e.hire_date)}</dd></div>
              {w && <div><dt className="text-xs text-ink-500">{t('staff.salary')}</dt><dd className="num font-medium">{money(e.salary)}</dd></div>}
            </dl>
            <p className="font-semibold">{t('staff.shifts')}</p>
            <div className="flex flex-wrap gap-1.5">{e.shifts.length ? e.shifts.map((s: any) => <span key={s.id} className={cx('num rounded-md px-2 py-1 text-xs', SHIFT_TONE[s.shift])}>{fmtShort(s.date, 'en')} · {t('shift.' + s.shift)}</span>) : <span className="text-ink-500">—</span>}</div>
          </div>
          <div>
            <p className="mb-2 font-semibold">{t('staff.performance')}</p>
            <ul className="mb-3 max-h-40 divide-y divide-ink-100 overflow-auto rounded-xl border border-ink-100">{e.reviews.map((x: any) => <li key={x.id} className="flex items-center justify-between px-3 py-2"><span><b className="num">{x.period}</b> <span className="text-ink-500">{x.notes}</span></span><span className="num flex items-center gap-1"><Star className="size-3 fill-gold-500 text-gold-500" />{x.score}</span></li>)}{!e.reviews.length && <li className="px-3 py-2 text-ink-500">—</li>}</ul>
            {w && <div className="grid grid-cols-3 gap-2"><Input type="month" value={r.period} onChange={(x) => setR({ ...r, period: x.target.value })} /><Input type="number" min={0} max={5} value={r.score} onChange={(x) => setR({ ...r, score: x.target.value })} /><Button onClick={add}>{t('staff.addReview')}</Button><Input className="col-span-3" placeholder={t('common.notes')} value={r.notes} onChange={(x) => setR({ ...r, notes: x.target.value })} /></div>}
          </div>
        </div>
      )}
    </Modal>
  )
}

function EmpForm({ emp, onClose, onSaved }: { emp: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n(); const toast = useToast(); const editing = !!emp.id
  const [v, setV] = useState<any>({ department: 'front_desk', status: 'active', ...emp }); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false)
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const save = async () => {
    setBusy(true); setErrs({})
    const body = { name: v.name, department: v.department, position: v.position ?? '', email: v.email || undefined, phone: v.phone ?? '', hire_date: v.hire_date || undefined, salary: v.salary === '' || v.salary == null ? undefined : Number(v.salary), status: v.status }
    try { await api(editing ? '/staff/' + emp.id : '/staff', { method: editing ? 'PUT' : 'POST', body }); toast(t('common.saved')); onSaved() } catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="md" title={editing ? t('common.edit') : t('staff.add')} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.name')} error={errs.name} className="sm:col-span-2"><Input value={v.name ?? ''} onChange={(e) => set('name', e.target.value)} error={!!errs.name} autoFocus /></Field>
        <Field label={t('staff.department')}><Select value={v.department} onChange={(e) => set('department', e.target.value)}>{DEPTS.map((d) => <option key={d} value={d}>{t('dept.' + d)}</option>)}</Select></Field>
        <Field label={t('staff.position')}><Input value={v.position ?? ''} onChange={(e) => set('position', e.target.value)} /></Field>
        <Field label={t('common.email')} error={errs.email} optional><Input type="email" dir="ltr" value={v.email ?? ''} onChange={(e) => set('email', e.target.value)} error={!!errs.email} /></Field>
        <Field label={t('common.phone')} optional><Input dir="ltr" value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label={t('staff.hired')} optional><Input type="date" value={v.hire_date ?? ''} onChange={(e) => set('hire_date', e.target.value)} /></Field>
        <Field label={t('staff.salary')} optional><Input type="number" min={0} value={v.salary ?? ''} onChange={(e) => set('salary', e.target.value)} /></Field>
        <Field label={t('common.status')}><Select value={v.status} onChange={(e) => set('status', e.target.value)}>{['active', 'on_leave', 'terminated'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}</Select></Field>
      </div>
    </Modal>
  )
}

function Shifts({ w }: { w: boolean }) {
  const { t, lang, dir } = useI18n(); const toast = useToast()
  const [from, setFrom] = useState(todayISO())
  const { data, error, loading, reload } = useApi<any[]>('/shifts' + qs({ from, to: addDaysISO(from, 6) }))
  const { data: st } = useApi<any>('/staff' + qs({ pageSize: 100, status: 'active' }))
  const [add, setAdd] = useState<{ date: string; staff_id: string; shift: string } | null>(null)
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(from, i))
  const save = async () => { try { await api('/shifts', { body: { staff_id: +add!.staff_id, date: add!.date, shift: add!.shift } }); setAdd(null); reload() } catch (e) { toast(errMsg(e), 'err') } }
  const del = async (id: number) => { try { await api('/shifts/' + id, { method: 'DELETE' }); reload() } catch (e) { toast(errMsg(e), 'err') } }
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft, Next = dir === 'rtl' ? ChevronLeft : ChevronRight
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-ink-100 p-4"><p className="num text-sm font-medium">{fmtShort(from, lang)} → {fmtShort(addDaysISO(from, 6), lang)}</p><div className="flex gap-1"><IconButton onClick={() => setFrom(addDaysISO(from, -7))}><Prev className="size-4" /></IconButton><Button size="sm" onClick={() => setFrom(todayISO())}>{t('res.today')}</Button><IconButton onClick={() => setFrom(addDaysISO(from, 7))}><Next className="size-4" /></IconButton></div></div>
      {loading && !data ? <Loading /> : error || !data ? <ErrorState error={error ?? new Error('')} retry={reload} /> : (
        <div className="grid grid-cols-1 gap-px bg-ink-100 sm:grid-cols-7">
          {days.map((d) => <div key={d} className="min-h-40 bg-white p-2"><div className={cx('mb-2 text-center text-xs', d === todayISO() ? 'font-semibold text-gold-600' : 'text-ink-500')}>{fmtWeekday(d, lang)} <span className="num">{fmtShort(d, lang)}</span></div>
            <div className="space-y-1">{data.filter((s) => s.date === d).map((s) => <div key={s.id} className={cx('group flex items-center justify-between rounded-md px-2 py-1 text-[11px]', SHIFT_TONE[s.shift])}><span className="truncate">{s.staff_name}</span>{w && <button onClick={() => del(s.id)} className="opacity-0 group-hover:opacity-100" aria-label={t('common.delete')}>×</button>}</div>)}</div>
            {w && <button onClick={() => setAdd({ date: d, staff_id: '', shift: 'morning' })} className="mt-2 w-full rounded-md border border-dashed border-ink-200 py-1 text-xs text-ink-400 hover:bg-ink-50">+</button>}</div>)}
        </div>
      )}
      <div className="flex gap-3 border-t border-ink-100 px-4 py-3 text-xs">{SHIFTS.map((s) => <span key={s} className={cx('rounded px-2 py-0.5', SHIFT_TONE[s])}>{t('shift.' + s)}</span>)}</div>
      {add && <Modal open onClose={() => setAdd(null)} size="sm" title={t('staff.addShift')} footer={<><Button onClick={() => setAdd(null)}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} disabled={!add.staff_id}>{t('common.save')}</Button></>}>
        <div className="space-y-4"><Field label={t('staff.employees')}><Select value={add.staff_id} onChange={(e) => setAdd({ ...add, staff_id: e.target.value })}><option value="">—</option>{(st?.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label={t('staff.shifts')}><Select value={add.shift} onChange={(e) => setAdd({ ...add, shift: e.target.value })}>{SHIFTS.map((s) => <option key={s} value={s}>{t('shift.' + s)}</option>)}</Select></Field></div></Modal>}
    </Card>
  )
}

function Attendance({ w }: { w: boolean }) {
  const { t } = useI18n(); const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const { data, error, loading, reload } = useApi<any>('/attendance' + qs({ date }))
  const act = async (staff_id: number, action: string) => { try { await api('/attendance', { body: { staff_id, date, action } }); reload() } catch (e) { toast(errMsg(e), 'err') } }
  return (
    <Card>
      <div className="border-b border-ink-100 p-4"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" /></div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <DataTable<any> rows={data.data.map((r: any) => ({ ...r, id: r.staff_id }))} cols={[
          { key: 'n', header: t('common.name'), render: (r) => <span className="font-medium text-ink-900">{r.staff_name}</span> },
          { key: 'd', header: t('staff.department'), render: (r) => t('dept.' + r.department), hideOnMobile: true },
          { key: 'in', header: t('staff.clockIn'), render: (r) => <span className="num">{r.check_in ?? '—'}</span> },
          { key: 'out', header: t('staff.clockOut'), render: (r) => <span className="num">{r.check_out ?? '—'}</span> },
          { key: 's', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
          { key: 'a', header: '', render: (r) => w && <span className="flex justify-end gap-1">{!r.check_in && <Button size="sm" onClick={() => act(r.staff_id, 'check_in')}><LogIn className="size-3.5" />{t('staff.clockIn')}</Button>}{r.check_in && !r.check_out && <Button size="sm" variant="primary" onClick={() => act(r.staff_id, 'check_out')}><LogOut className="size-3.5" />{t('staff.clockOut')}</Button>}</span> },
        ]} />
      )}
    </Card>
  )
}
