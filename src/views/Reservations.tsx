import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, DoorClosed, DoorOpen, Footprints, Pencil, Plus, Star, UserPlus, Wallet, XCircle } from 'lucide-react'
import { api, qs, useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { addDaysISO, fmtShort, fmtWeekday, nightsBetween, todayISO } from '@/lib/format'
import { Badge, Button, Card, DataTable, ErrorState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Tabs, Textarea, cx, errMsg, fieldErrors, useToast, Confirm } from '@/components/ui'
import { PaymentModal } from '@/components/Payment'
import { GuestForm } from './Guests'
import { Link } from 'react-router-dom'

const SOURCES = ['direct', 'phone', 'website', 'booking_com', 'expedia', 'agency']
const BAR: Record<string, string> = { confirmed: 'bg-sky-500', checked_in: 'bg-emerald-500', checked_out: 'bg-ink-400' }

export default function Reservations() {
  const { t } = useI18n(); const { can } = useAuth(); const w = can('reservations', 'write')
  const [sp, setSp] = useSearchParams()
  const [tab, setTab] = useState<'list' | 'calendar'>('list')
  const [form, setForm] = useState<any | null>(null)
  const [open, setOpen] = useState<number | null>(sp.get('open') ? +sp.get('open')! : null)
  const closeDetail = () => { setOpen(null); if (sp.get('open')) { sp.delete('open'); setSp(sp, { replace: true }) } }
  return (
    <div>
      <PageHeader title={t('res.title')} subtitle={t('res.subtitle')} actions={w && <>
        <Button onClick={() => setForm({ walk_in: true })}><Footprints className="size-4" />{t('res.walkin')}</Button>
        <Button variant="primary" onClick={() => setForm({})}><Plus className="size-4" />{t('res.new')}</Button>
      </>} />
      <Tabs tabs={[{ id: 'list', label: t('res.list') }, { id: 'calendar', label: t('res.calendar') }]} value={tab} onChange={setTab} />
      {tab === 'list' ? <ListView onOpen={setOpen} /> : <CalendarView onOpen={setOpen} onNew={(room_id, check_in) => w && setForm({ room_id, check_in, check_out: addDaysISO(check_in, 1) })} canWrite={w} />}
      {form && <ReservationForm init={form} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); if (id) setOpen(id) }} />}
      {open !== null && <ReservationDetail id={open} onClose={closeDetail} onEdit={(r) => { closeDetail(); setForm(r) }} canWrite={w} />}
    </div>
  )
}

function ListView({ onOpen }: { onOpen: (id: number) => void }) {
  const { t, date, money } = useI18n()
  const [f, setF] = useState({ q: '', status: '', source: '', quick: '', page: 1, sort: 'check_in', dir: 'desc' })
  const today = todayISO()
  const params = { q: f.q, status: f.status, source: f.source, page: f.page, sort: f.sort, dir: f.dir, pageSize: 15, arrivals: f.quick === 'arrivals' ? today : '', departures: f.quick === 'departures' ? today : '' }
  const { data, error, loading, reload } = useApi<any>('/reservations' + qs(params))
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v, page: 1 }))
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
        <SearchInput value={f.q} onChange={(v) => set('q', v)} />
        <Select value={f.status} onChange={(e) => set('status', e.target.value)} className="w-44" aria-label={t('common.status')}><option value="">{t('common.status')}: {t('common.all')}</option>{['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}</Select>
        <Select value={f.source} onChange={(e) => set('source', e.target.value)} className="w-44" aria-label={t('res.source')}><option value="">{t('res.source')}: {t('common.all')}</option>{[...SOURCES, 'walk_in'].map((s) => <option key={s} value={s}>{t('source.' + s)}</option>)}</Select>
        <div className="flex gap-1">{(['arrivals', 'departures'] as const).map((k) => <Button key={k} size="sm" variant={f.quick === k ? 'primary' : 'secondary'} onClick={() => set('quick', f.quick === k ? '' : k)}>{k === 'arrivals' ? <DoorOpen className="size-3.5" /> : <DoorClosed className="size-3.5" />}{t('res.' + k)} · {t('res.today')}</Button>)}</div>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <>
          <DataTable<any> rows={data.data} sort={f.sort} dir={f.dir as any} onSort={(s) => setF((x) => ({ ...x, sort: s, dir: x.sort === s && x.dir === 'asc' ? 'desc' : 'asc' }))} onRow={(r) => onOpen(r.id)} cols={[
            { key: 'code', header: t('res.code'), sort: 'code', render: (r) => <span className="num font-medium text-ink-900">{r.code}</span> },
            { key: 'guest', header: t('res.guest'), sort: 'guest_name', render: (r) => <span className="flex items-center gap-1.5">{r.guest_name}{r.guest_vip ? <Star className="size-3 fill-gold-500 text-gold-500" /> : null}</span> },
            { key: 'room', header: t('res.room'), sort: 'room_number', render: (r) => <span className="num">{r.room_number} <span className="text-ink-400">· {r.category_name}</span></span>, hideOnMobile: true },
            { key: 'in', header: t('res.checkin'), sort: 'check_in', render: (r) => <span className="tabular-nums">{date(r.check_in)}</span> },
            { key: 'out', header: t('res.checkout'), sort: 'check_out', render: (r) => <span className="tabular-nums">{date(r.check_out)}</span>, hideOnMobile: true },
            { key: 'total', header: t('common.total'), sort: 'total', render: (r) => <span className="num">{money(r.total)}</span>, hideOnMobile: true },
            { key: 'status', header: t('common.status'), sort: 'status', render: (r) => <StatusBadge status={r.status} /> },
          ]} />
          <Pagination page={f.page} pageSize={15} total={data.total} onPage={(p) => setF((x) => ({ ...x, page: p }))} />
        </>
      )}
    </Card>
  )
}

function CalendarView({ onOpen, onNew, canWrite }: { onOpen: (id: number) => void; onNew: (room: number, date: string) => void; canWrite: boolean }) {
  const { t, lang, dir } = useI18n(); const toast = useToast()
  const [vw, setVw] = useState(typeof window === 'undefined' ? 1200 : window.innerWidth)
  useEffect(() => { const f = () => setVw(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  const mobile = vw < 640, DAYS = mobile ? 7 : 21, LW = mobile ? 64 : 120
  const [from, setFrom] = useState(addDaysISO(todayISO(), -2))
  const to = addDaysISO(from, DAYS)
  const { data, error, loading, reload } = useApi<any>('/calendar' + qs({ from, to }))
  const [drag, setDrag] = useState<any | null>(null); const [over, setOver] = useState<string | null>(null)
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDaysISO(from, i)), [from])
  const today = todayISO()
  const move = async (r: any, roomId: number, day: string) => {
    const n = nightsBetween(r.check_in, r.check_out)
    const body: any = { room_id: roomId, check_in: day, check_out: addDaysISO(day, n) }
    if (r.status === 'checked_in') { delete body.check_in; body.check_out = r.check_out }
    try { await api('/reservations/' + r.id, { method: 'PUT', body }); toast(t('res.moved')); reload() } catch (e) { toast(errMsg(e), 'err') }
  }
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft, Next = dir === 'rtl' ? ChevronLeft : ChevronRight
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorState error={error ?? new Error('')} retry={reload} />
  const COL = mobile ? Math.max(36, Math.floor((vw - 34 - LW) / DAYS)) : 56
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 p-4">
        <p className="text-xs text-ink-500">{mobile ? t('res.tapHint') : t('res.dragHint')}</p>
        <div className="flex items-center gap-1"><IconButton onClick={() => setFrom(addDaysISO(from, mobile ? -DAYS : -7))} aria-label={t('res.prev')}><Prev className="size-4" /></IconButton><Button size="sm" onClick={() => setFrom(addDaysISO(todayISO(), -2))}>{t('res.today')}</Button><IconButton onClick={() => setFrom(addDaysISO(from, mobile ? DAYS : 7))} aria-label={t('res.next')}><Next className="size-4" /></IconButton></div>
      </div>
      <div className="overflow-x-auto" dir="ltr">
        <div style={{ minWidth: LW + COL * DAYS }}>
          <div className="sticky top-0 z-10 flex border-b border-ink-100 bg-white">
            <div className="sticky left-0 z-10 shrink-0 border-e border-ink-100 bg-white px-2 py-2 text-xs font-medium text-ink-500 sm:px-3" style={{ width: LW }}>{t('res.room')}</div>
            {days.map((d) => <div key={d} style={{ width: COL }} className={cx('shrink-0 border-e border-ink-100 py-1.5 text-center text-[11px]', d === today ? 'bg-gold-100 font-semibold text-gold-600' : [5, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()) ? 'bg-ink-50 text-ink-500' : 'text-ink-500')}><div>{fmtWeekday(d, lang)}</div><div className="num">{fmtShort(d, lang)}</div></div>)}
          </div>
          {data.rooms.map((rm: any) => {
            const bookings = data.reservations.filter((r: any) => r.room_id === rm.id)
            return (
              <div key={rm.id} className="relative flex border-b border-ink-100 last:border-0" style={{ height: 40 }}>
                <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-e border-ink-100 bg-white px-2 text-xs sm:px-3" style={{ width: LW }}><b className="num text-ink-900">{rm.number}</b><span className="truncate text-ink-400 max-sm:hidden">{rm.category_name}</span></div>
                {days.map((d) => {
                  const key = rm.id + d
                  return <div key={d} style={{ width: COL }} onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(key) } }} onDragLeave={() => setOver(null)} onDrop={() => { if (drag) move(drag, rm.id, d); setDrag(null); setOver(null) }} onClick={() => onNew(rm.id, d)}
                    className={cx('shrink-0 border-e border-ink-100', d === today && 'bg-gold-100/40', over === key && 'bg-gold-200', canWrite && 'cursor-pointer hover:bg-ink-50')} />
                })}
                {bookings.map((r: any) => {
                  const s = Math.max(0, nightsBetween(from, r.check_in)), e = Math.min(DAYS, nightsBetween(from, r.check_out))
                  if (e <= s) return null
                  const cut = nightsBetween(from, r.check_in) < 0
                  return (
                    <div key={r.id} draggable={canWrite && r.status !== 'checked_out'} onDragStart={() => setDrag(r)} onDragEnd={() => { setDrag(null); setOver(null) }} onClick={(ev) => { ev.stopPropagation(); onOpen(r.id) }}
                      title={`${r.guest_name} · ${r.code}`}
                      className={cx('absolute top-1.5 flex h-7 cursor-pointer items-center gap-1 overflow-hidden px-2 text-[11px] font-medium text-white shadow-sm', BAR[r.status], cut ? 'rounded-e-md' : 'rounded-md', r.status === 'checked_out' && 'opacity-60')}
                      style={{ left: LW + s * COL + 2, width: (e - s) * COL - 4 }}>
                      {r.guest_vip ? <Star className="size-3 shrink-0 fill-white" /> : null}<span className="truncate">{r.guest_name}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex gap-4 border-t border-ink-100 px-4 py-3 text-xs text-ink-500">{(['confirmed', 'checked_in', 'checked_out'] as const).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={cx('size-2.5 rounded', BAR[s])} />{t('status.' + s)}</span>)}</div>
    </Card>
  )
}

export function ReservationForm({ init, onClose, onSaved }: { init: any; onClose: () => void; onSaved: (id?: number) => void }) {
  const { t, money } = useI18n(); const toast = useToast()
  const walk = !!init.walk_in
  const today = todayISO()
  const [v, setV] = useState<any>({ adults: 1, children: 0, source: walk ? 'walk_in' : 'direct', check_in: walk ? today : today, check_out: addDaysISO(today, 1), ...init })
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [newGuest, setNewGuest] = useState(false)
  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }))
  const [gq, setGq] = useState('')
  const { data: guests, reload: reloadGuests } = useApi<any>('/guests' + qs({ q: gq, pageSize: 30, sort: 'name', dir: 'asc' }))
  const valid = v.check_in && v.check_out && v.check_out > v.check_in
  const { data: avail } = useApi<any>(valid ? '/rooms' + qs({ available_from: v.check_in, available_to: v.check_out, pageSize: 200 }) : null)
  const editing = !!init.id
  const rooms: any[] = useMemo(() => { const a = avail?.data ?? []; if (editing && init.room_id && !a.find((r: any) => r.id === init.room_id)) return [{ id: init.room_id, number: init.room_number, category_name: init.category_name, price: init.rate, capacity: 9 }, ...a]; return a }, [avail, editing, init])
  const room = rooms.find((r) => r.id === +v.room_id)
  useEffect(() => { if (room && !editing && v._priceFor !== room.id) setV((s: any) => ({ ...s, rate: room.price, _priceFor: room.id })) }, [room?.id])
  const nights = valid ? nightsBetween(v.check_in, v.check_out) : 0
  const est = (Number(v.rate) || 0) * nights
  const save = async () => {
    setBusy(true); setErrs({})
    const body: any = { guest_id: +v.guest_id, room_id: +v.room_id, check_in: v.check_in, check_out: v.check_out, adults: +v.adults, children: +v.children, source: v.source, rate: v.rate === '' ? undefined : Number(v.rate), notes: v.notes ?? '', walk_in: walk ? 1 : 0 }
    try { const r: any = editing ? await api('/reservations/' + init.id, { method: 'PUT', body }) : await api('/reservations', { body }); toast(t('common.saved')); onSaved(editing ? init.id : r.id) }
    catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="lg" title={editing ? t('res.editTitle', { c: init.code }) : walk ? t('res.walkinTitle') : t('res.newTitle')} footer={<>
      {!editing && <span className="me-auto text-sm text-ink-500">{t('res.estTotal')}: <b className="num text-ink-900">{money(est)}</b></span>}
      <Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save} disabled={!v.guest_id || !v.room_id || !valid}>{t('common.save')}</Button></>}>
      {walk && !editing && <p className="mb-4 rounded-lg bg-gold-100 px-3 py-2 text-sm text-gold-600">{t('res.walkinHint')}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('res.guest')} error={errs.guest_id} className="sm:col-span-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2"><Input placeholder={t('common.search')} value={gq} onChange={(e) => setGq(e.target.value)} />
              <Select value={v.guest_id ?? ''} onChange={(e) => set('guest_id', e.target.value)} error={!!errs.guest_id}><option value="">{t('res.selectGuest')}</option>{(guests?.data ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.name}{g.vip ? ' ★' : ''} {g.phone ? `· ${g.phone}` : ''}</option>)}{editing && v.guest_id && !(guests?.data ?? []).find((g: any) => g.id === +v.guest_id) && <option value={v.guest_id}>{init.guest_name}</option>}</Select></div>
            <Button className="self-start" onClick={() => setNewGuest(true)}><UserPlus className="size-4" />{t('res.newGuest')}</Button>
          </div>
        </Field>
        <Field label={t('res.checkin')} error={errs.check_in}><Input type="date" value={v.check_in} min={walk ? today : today} disabled={walk || init.status === 'checked_in'} onChange={(e) => { set('check_in', e.target.value); if (v.check_out <= e.target.value) set('check_out', addDaysISO(e.target.value, 1)) }} /></Field>
        <Field label={t('res.checkout')} error={errs.check_out}><Input type="date" value={v.check_out} min={addDaysISO(v.check_in, 1)} onChange={(e) => set('check_out', e.target.value)} error={!!errs.check_out} /></Field>
        <Field label={`${t('res.room')} (${t('res.availableRooms')}: ${rooms.length})`} error={errs.room_id} className="sm:col-span-2">
          <Select value={v.room_id ?? ''} onChange={(e) => set('room_id', e.target.value)} error={!!errs.room_id} disabled={init.status === 'checked_in'}><option value="">{rooms.length ? t('res.selectRoom') : t('res.noRooms')}</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.category_name} · {money(r.price)} · {t('rooms.sleeps', { n: r.capacity })}</option>)}</Select>
        </Field>
        <Field label={t('res.adults')} error={errs.adults}><Input type="number" min={1} value={v.adults} onChange={(e) => set('adults', e.target.value)} error={!!errs.adults} /></Field>
        <Field label={t('res.children')}><Input type="number" min={0} value={v.children} onChange={(e) => set('children', e.target.value)} /></Field>
        <Field label={t('res.source')}><Select value={v.source} onChange={(e) => set('source', e.target.value)} disabled={walk}>{[...SOURCES, ...(walk ? ['walk_in'] : [])].map((s) => <option key={s} value={s}>{t('source.' + s)}</option>)}</Select></Field>
        <Field label={t('res.rate')} hint={nights ? `${nights} ${t('common.nights')}` : undefined}><Input type="number" min={0} step="1" value={v.rate ?? ''} onChange={(e) => set('rate', e.target.value)} /></Field>
        <Field label={t('common.notes')} optional className="sm:col-span-2"><Textarea value={v.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
      {newGuest && <GuestForm guest={{}} onClose={() => setNewGuest(false)} onSaved={(id) => { setNewGuest(false); reloadGuests(); if (id) set('guest_id', id) }} />}
    </Modal>
  )
}

function ReservationDetail({ id, onClose, onEdit, canWrite }: { id: number; onClose: () => void; onEdit: (r: any) => void; canWrite: boolean }) {
  const { t, money, date, dt } = useI18n(); const toast = useToast()
  const { data: r, reload, error } = useApi<any>(`/reservations/${id}`)
  const [pay, setPay] = useState(false); const [cancel, setCancel] = useState(false); const [busy, setBusy] = useState('')
  const act = async (name: string, path: string, body?: any) => {
    setBusy(name)
    try { await api(`/reservations/${id}/${path}`, { body: body ?? {} }); toast(t('common.saved')); reload() }
    catch (e: any) { toast(errMsg(e), 'err'); if (e.status === 402) setPay(true) } finally { setBusy('') }
  }
  const inv = r?.invoice
  return (
    <Modal open onClose={onClose} size="lg" title={r ? <span className="flex items-center gap-3">{r.code}<StatusBadge status={r.status} /></span> : '...'} footer={r && canWrite ? <>
      {r.status === 'confirmed' && <><Button onClick={() => onEdit(r)}><Pencil className="size-4" />{t('common.edit')}</Button><Button variant="danger" onClick={() => setCancel(true)}><XCircle className="size-4" />{t('res.cancelRes')}</Button><Button variant="primary" loading={busy === 'in'} onClick={() => act('in', 'check-in')}><DoorOpen className="size-4" />{t('res.doCheckIn')}</Button></>}
      {r.status === 'checked_in' && <><Button onClick={() => onEdit(r)}><Pencil className="size-4" />{t('common.edit')}</Button>{inv && inv.balance > 0.004 && <Button variant="gold" onClick={() => setPay(true)}><Wallet className="size-4" />{t('res.collect')}</Button>}<Button variant="primary" loading={busy === 'out'} onClick={() => act('out', 'check-out')}><DoorClosed className="size-4" />{t('res.doCheckOut')}</Button></>}
    </> : undefined}>
      {error ? <ErrorState error={error} /> : !r ? <Loading /> : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 text-sm">
            <div><p className="text-xs text-ink-500">{t('res.guest')}</p><p className="flex items-center gap-1.5 text-base font-semibold">{r.guest_name}{r.guest_vip ? <Badge tone="gold"><Star className="size-3 fill-current" />VIP</Badge> : null}</p>{r.guest_phone && <p className="num text-ink-500">{r.guest_phone}</p>}</div>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-ink-500">{t('res.room')}</dt><dd className="num font-semibold">{r.room_number} · {r.category_name}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('res.source')}</dt><dd className="font-semibold">{t('source.' + r.source)}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('res.checkin')}</dt><dd className="tabular-nums font-semibold">{date(r.check_in)}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('res.checkout')}</dt><dd className="tabular-nums font-semibold">{date(r.check_out)}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('res.nights')}</dt><dd className="num font-semibold">{r.nights}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('common.guests')}</dt><dd className="num font-semibold">{r.adults} + {r.children}</dd></div>
              {r.checked_in_at && <div><dt className="text-xs text-ink-500">{t('res.checkedIn')}</dt><dd className="tabular-nums">{dt(r.checked_in_at)}</dd></div>}
              {r.checked_out_at && <div><dt className="text-xs text-ink-500">{t('res.checkedOut')}</dt><dd className="tabular-nums">{dt(r.checked_out_at)}</dd></div>}
            </dl>
            {r.cancel_reason && <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{r.cancel_reason}</p>}
            {r.notes && <p className="rounded-lg bg-ink-50 px-3 py-2 text-ink-600">{r.notes}</p>}
          </div>
          <div className="rounded-xl border border-ink-100 p-4 text-sm">
            <div className="mb-3 flex items-center justify-between"><p className="font-semibold">{t('res.invoice')} {inv?.number}</p>{inv && <StatusBadge status={inv.state} />}</div>
            {inv ? (<>
              <dl className="space-y-1.5">
                <div className="flex justify-between"><dt className="text-ink-500">{t('bill.subtotal')}</dt><dd className="num">{money(inv.subtotal)}</dd></div>
                {inv.discount > 0 && <div className="flex justify-between"><dt className="text-ink-500">{t('bill.discount')}</dt><dd className="num">-{money(inv.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-ink-500">{t('bill.service')} ({inv.service_rate}%)</dt><dd className="num">{money(inv.service)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">{t('bill.tax')} ({inv.tax_rate}%)</dt><dd className="num">{money(inv.tax)}</dd></div>
                <div className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><dt>{t('common.total')}</dt><dd className="num">{money(inv.total)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">{t('bill.paid')}</dt><dd className="num text-emerald-600">{money(inv.paid)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>{t('bill.balance')}</dt><dd className={cx('num', inv.balance > 0.004 ? 'text-rose-600' : 'text-ink-900')}>{money(inv.balance)}</dd></div>
              </dl>
              <Link to={`/billing?open=${inv.id}`} className="mt-3 inline-block text-xs font-medium text-gold-600 hover:underline">{t('bill.invoice')} →</Link>
            </>) : null}
          </div>
        </div>
      )}
      {pay && inv && <PaymentModal invoiceId={inv.id} number={inv.number} balance={inv.balance} paid={inv.paid} onClose={() => setPay(false)} onDone={() => { setPay(false); reload() }} />}
      {cancel && r && <CancelModal r={r} onClose={() => setCancel(false)} onDone={() => { setCancel(false); reload() }} />}
    </Modal>
  )
}

function CancelModal({ r, onClose, onDone }: { r: any; onClose: () => void; onDone: () => void }) {
  const { t, money } = useI18n(); const toast = useToast()
  const paid = r.invoice?.paid ?? 0
  const [reason, setReason] = useState(''); const [refund, setRefund] = useState(String(paid)); const [method, setMethod] = useState('cash'); const [noShow, setNoShow] = useState(false); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({})
  const go = async () => {
    setBusy(true); setErrs({})
    try { await api(`/reservations/${r.id}/cancel`, { body: { reason, refund_amount: Number(refund) || 0, refund_method: method, no_show: noShow ? 1 : 0 } }); toast(t('common.saved')); onDone() }
    catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="sm" title={t('res.cancelTitle', { c: r.code })} footer={<><Button onClick={onClose}>{t('common.back')}</Button><Button variant="danger" loading={busy} onClick={go}>{noShow ? t('res.noShow') : t('res.cancelRes')}</Button></>}>
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={noShow} onChange={(e) => setNoShow(e.target.checked)} className="size-4 accent-gold-500" />{t('res.noShow')}</label>
        <Field label={t('res.cancelReason')} optional><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {paid > 0 && <>
          <p className="text-xs text-ink-500">{t('res.paidSoFar', { n: money(paid) })}</p>
          <Field label={t('res.refund')} error={errs.refund_amount}><Input type="number" min={0} max={paid} step="1" value={refund} onChange={(e) => setRefund(e.target.value)} error={!!errs.refund_amount} /></Field>
          <Field label={t('res.refundMethod')}><Select value={method} onChange={(e) => setMethod(e.target.value)}>{['cash', 'card', 'bank_transfer', 'mobile_wallet', 'online'].map((m) => <option key={m} value={m}>{t('method.' + m)}</option>)}</Select></Field>
        </>}
      </div>
    </Modal>
  )
}
