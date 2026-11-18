import { useMemo, useState } from 'react'
import { BedDouble, LayoutGrid, Map as MapIcon, Pencil, Plus, Rows3, Tags, Trash2, Users } from 'lucide-react'
import { api, qs, useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Badge, Button, Card, Confirm, DataTable, EmptyState, ErrorState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Textarea, cx, errMsg, fieldErrors, useToast } from '@/components/ui'

type Room = { id: number; number: string; floor: number; category_id: number; category_name: string; price: number; capacity: number; amenities: string[]; status: string; housekeeping_status: string; image: string | null; notes: string; current_guest?: string; current_checkout?: string }
const STATUS_RING: Record<string, string> = { available: 'bg-emerald-500', occupied: 'bg-sky-500', maintenance: 'bg-amber-500' }
const STATUS_TILE: Record<string, string> = {
  available: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400', occupied: 'border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-400', maintenance: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400',
}
const HK_DOT: Record<string, string> = { clean: 'bg-emerald-500', dirty: 'bg-rose-500', cleaning: 'bg-amber-500', inspected: 'bg-violet-500' }

export default function Rooms() {
  const { t, money, date } = useI18n(); const { can } = useAuth(); const canWrite = can('rooms', 'write')
  const [view, setView] = useState<'cards' | 'map' | 'table'>('cards')
  const [f, setF] = useState({ q: '', status: '', category_id: '', floor: '', housekeeping_status: '', available_from: '', available_to: '', page: 1, sort: 'number', dir: 'asc' })
  const pageSize = view === 'table' ? 15 : 200
  const { data, error, loading, reload } = useApi<{ data: Room[]; total: number }>('/rooms' + qs({ ...f, pageSize }))
  const { data: cats, reload: reloadCats } = useApi<any[]>('/categories')
  const [edit, setEdit] = useState<Partial<Room> | null>(null)
  const [del, setDel] = useState<Room | null>(null)
  const [detail, setDetail] = useState<number | null>(null)
  const [catsOpen, setCatsOpen] = useState(false)
  const toast = useToast()
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v, page: k === 'page' ? v : 1 }))
  const floors = useMemo(() => [...new Set((data?.data ?? []).map((r) => r.floor))].sort(), [data])
  const rooms = data?.data ?? []
  const stats = { available: rooms.filter((r) => r.status === 'available').length, occupied: rooms.filter((r) => r.status === 'occupied').length, maintenance: rooms.filter((r) => r.status === 'maintenance').length }

  return (
    <div>
      <PageHeader title={t('rooms.title')} subtitle={t('rooms.subtitle')} actions={<>
        {can('rooms', 'write') && <Button onClick={() => setCatsOpen(true)}><Tags className="size-4" />{t('rooms.categories')}</Button>}
        {canWrite && <Button variant="primary" onClick={() => setEdit({ floor: 1, capacity: 2, status: 'available', housekeeping_status: 'clean', amenities: [], category_id: cats?.[0]?.id, price: cats?.[0]?.base_price })}><Plus className="size-4" />{t('rooms.add')}</Button>}
      </>} />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <SearchInput value={f.q} onChange={(v) => set('q', v)} />
          <Select value={f.status} onChange={(e) => set('status', e.target.value)} className="w-40" aria-label={t('common.status')}>
            <option value="">{t('common.status')}: {t('common.all')}</option>{['available', 'occupied', 'maintenance'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}
          </Select>
          <Select value={f.category_id} onChange={(e) => set('category_id', e.target.value)} className="w-44" aria-label={t('rooms.category')}>
            <option value="">{t('rooms.category')}: {t('common.all')}</option>{cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={f.housekeeping_status} onChange={(e) => set('housekeeping_status', e.target.value)} className="w-44" aria-label={t('rooms.housekeeping')}>
            <option value="">{t('rooms.housekeeping')}: {t('common.all')}</option>{['clean', 'dirty', 'cleaning', 'inspected'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}
          </Select>
          <div className="flex items-end gap-2">
            <Field label={t('rooms.availableFor')}><Input type="date" value={f.available_from} onChange={(e) => set('available_from', e.target.value)} className="w-40" /></Field>
            <Field><Input type="date" value={f.available_to} min={f.available_from} onChange={(e) => set('available_to', e.target.value)} className="w-40" /></Field>
          </div>
          {(f.q || f.status || f.category_id || f.housekeeping_status || f.available_from) && <Button variant="ghost" onClick={() => setF({ ...f, q: '', status: '', category_id: '', housekeeping_status: '', available_from: '', available_to: '', floor: '', page: 1 })}>{t('common.clear')}</Button>}
          <div className="ms-auto flex rounded-lg border border-ink-200 bg-white p-0.5">
            {([['cards', LayoutGrid, 'rooms.grid'], ['map', MapIcon, 'rooms.map'], ['table', Rows3, 'rooms.table']] as const).map(([v, Icon, k]) => (
              <button key={v} onClick={() => setView(v)} aria-label={t(k)} title={t(k)} className={cx('flex size-8 items-center justify-center rounded-md', view === v ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100')}><Icon className="size-4" /></button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-500">
          {(['available', 'occupied', 'maintenance'] as const).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={cx('size-2 rounded-full', STATUS_RING[s])} />{t('status.' + s)} <b className="num text-ink-800">{stats[s]}</b></span>)}
          <span className="ms-auto flex items-center gap-3">{(['clean', 'dirty', 'cleaning', 'inspected'] as const).map((s) => <span key={s} className="flex items-center gap-1"><span className={cx('size-1.5 rounded-full', HK_DOT[s])} />{t('status.' + s)}</span>)}</span>
        </div>
      </Card>

      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : !rooms.length ? <Card><EmptyState /></Card> : view === 'cards' ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rooms.map((r) => (
            <Card key={r.id} className="group overflow-hidden transition-shadow hover:shadow-lg">
              <button className="block w-full text-start" onClick={() => setDetail(r.id)}>
                <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
                  {r.image && <img src={r.image} alt={r.category_name} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
                  <div className="absolute start-3 top-3 flex gap-1.5"><StatusBadge status={r.status} /></div>
                  <div className="absolute inset-x-3 bottom-3 flex items-end justify-between text-white">
                    <div><p className="font-display text-2xl font-semibold leading-none">{r.number}</p><p className="mt-1 text-xs text-white/80">{r.category_name} · {t('rooms.floorN', { n: r.floor })}</p></div>
                    <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-xs backdrop-blur"><span className={cx('size-1.5 rounded-full', HK_DOT[r.housekeeping_status])} />{t('status.' + r.housekeeping_status)}</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between"><p className="num text-base font-semibold text-ink-900">{money(r.price)}<span className="text-xs font-normal text-ink-400"> / {t('common.night')}</span></p><span className="flex items-center gap-1 text-xs text-ink-500"><Users className="size-3.5" />{r.capacity}</span></div>
                  {r.status === 'occupied' && r.current_guest ? <p className="mt-2 truncate text-xs text-ink-600">{r.current_guest} · {t('rooms.checkout')} <span className="num">{date(r.current_checkout)}</span></p> : <div className="mt-2 flex flex-wrap gap-1">{r.amenities.slice(0, 4).map((a) => <Badge key={a}>{a}</Badge>)}{r.amenities.length > 4 && <Badge>+{r.amenities.length - 4}</Badge>}</div>}
                </div>
              </button>
              {canWrite && <div className="flex justify-end gap-1 border-t border-ink-100 px-2 py-1.5"><IconButton onClick={() => setEdit(r)} aria-label={t('common.edit')}><Pencil className="size-4" /></IconButton><IconButton onClick={() => setDel(r)} aria-label={t('common.delete')}><Trash2 className="size-4" /></IconButton></div>}
            </Card>
          ))}
        </div>
      ) : view === 'map' ? (
        <div className="space-y-4">
          {[...new Set(rooms.map((r) => r.floor))].sort((a, b) => b - a).map((fl) => (
            <Card key={fl} className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink-700">{t('rooms.floorN', { n: fl })}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {rooms.filter((r) => r.floor === fl).map((r) => (
                  <button key={r.id} onClick={() => setDetail(r.id)} className={cx('relative rounded-xl border-2 p-3 text-start transition-colors', STATUS_TILE[r.status])}>
                    <span className={cx('absolute end-2 top-2 size-2 rounded-full', HK_DOT[r.housekeeping_status])} title={t('status.' + r.housekeeping_status)} />
                    <p className="num text-xl font-semibold">{r.number}</p><p className="truncate text-[11px] opacity-80">{r.category_name}</p>
                    <p className="mt-1 truncate text-[11px] font-medium">{r.status === 'occupied' ? r.current_guest : t('status.' + r.status)}</p>
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <DataTable<Room> rows={rooms} sort={f.sort} dir={f.dir as any} onSort={(s) => setF((x) => ({ ...x, sort: s, dir: x.sort === s && x.dir === 'asc' ? 'desc' : 'asc' }))} onRow={(r) => setDetail(r.id)} cols={[
            { key: 'number', header: t('rooms.number'), sort: 'number', render: (r) => <b className="num">{r.number}</b> },
            { key: 'category', header: t('rooms.category'), sort: 'category_name', render: (r) => r.category_name },
            { key: 'floor', header: t('rooms.floor'), sort: 'floor', render: (r) => <span className="num">{r.floor}</span>, hideOnMobile: true },
            { key: 'capacity', header: t('rooms.capacity'), sort: 'capacity', render: (r) => <span className="num">{r.capacity}</span>, hideOnMobile: true },
            { key: 'price', header: t('rooms.price'), sort: 'price', render: (r) => <span className="num">{money(r.price)}</span> },
            { key: 'status', header: t('common.status'), sort: 'status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'hk', header: t('rooms.housekeeping'), sort: 'housekeeping_status', render: (r) => <StatusBadge status={r.housekeeping_status} /> },
            { key: 'actions', header: '', render: (r) => canWrite && <div className="flex justify-end" onClick={(e) => e.stopPropagation()}><IconButton onClick={() => setEdit(r)} aria-label={t('common.edit')}><Pencil className="size-4" /></IconButton><IconButton onClick={() => setDel(r)} aria-label={t('common.delete')}><Trash2 className="size-4" /></IconButton></div> },
          ]} />
          <Pagination page={f.page} pageSize={pageSize} total={data?.total ?? 0} onPage={(p) => set('page', p)} />
        </Card>
      )}

      {edit && <RoomForm room={edit} cats={cats ?? []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); reloadCats() }} />}
      {detail !== null && <RoomDetail id={detail} onClose={() => setDetail(null)} onEdit={(r) => { setDetail(null); setEdit(r) }} canWrite={canWrite} />}
      <Confirm open={!!del} onClose={() => setDel(null)} title={t('rooms.deleteTitle')} message={del ? `${t('rooms.number')} ${del.number}. ${t('common.confirmDelete')}` : ''} onConfirm={async () => {
        try { await api(`/rooms/${del!.id}`, { method: 'DELETE' }); toast(t('common.deleted')); setDel(null); reload() } catch (e) { toast(errMsg(e), 'err'); setDel(null) }
      }} />
      {catsOpen && <Categories onClose={() => { setCatsOpen(false); reload() }} />}
    </div>
  )
}

function RoomForm({ room, cats, onClose, onSaved }: { room: Partial<Room>; cats: any[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n(); const toast = useToast()
  const [v, setV] = useState({ ...room, amenitiesText: (room.amenities ?? []).join(', ') } as any)
  const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false)
  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }))
  const save = async () => {
    setBusy(true); setErrs({})
    const body = { number: v.number, floor: v.floor, category_id: v.category_id, price: v.price, capacity: v.capacity, status: v.status, housekeeping_status: v.housekeeping_status, image: v.image || null, notes: v.notes ?? '', amenities: String(v.amenitiesText ?? '').split(',').map((s: string) => s.trim()).filter(Boolean) }
    try { room.id ? await api(`/rooms/${room.id}`, { method: 'PUT', body }) : await api('/rooms', { body }); toast(t('common.saved')); onSaved() }
    catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={room.id ? t('rooms.editTitle', { n: room.number! }) : t('rooms.newTitle')} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('rooms.number')} error={errs.number}><Input value={v.number ?? ''} onChange={(e) => set('number', e.target.value)} error={!!errs.number} /></Field>
        <Field label={t('rooms.floor')} error={errs.floor}><Input type="number" min={0} value={v.floor ?? ''} onChange={(e) => set('floor', e.target.value)} /></Field>
        <Field label={t('rooms.category')} error={errs.category_id}>
          <Select value={v.category_id ?? ''} onChange={(e) => { const c = cats.find((x) => x.id === +e.target.value); set('category_id', +e.target.value); if (c && !room.id) { set('price', c.base_price); set('capacity', c.capacity); set('amenitiesText', c.amenities.join(', ')); set('image', c.image) } }}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Field label={t('rooms.price')} error={errs.price}><Input type="number" min={0} step="1" value={v.price ?? ''} onChange={(e) => set('price', e.target.value)} error={!!errs.price} /></Field>
        <Field label={t('rooms.capacity')} error={errs.capacity}><Input type="number" min={1} value={v.capacity ?? ''} onChange={(e) => set('capacity', e.target.value)} /></Field>
        <Field label={t('common.status')}><Select value={v.status} onChange={(e) => set('status', e.target.value)}>{['available', 'occupied', 'maintenance'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}</Select></Field>
        <Field label={t('rooms.housekeeping')}><Select value={v.housekeeping_status} onChange={(e) => set('housekeeping_status', e.target.value)}>{['clean', 'dirty', 'cleaning', 'inspected'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}</Select></Field>
        <Field label={t('rooms.image')} optional><Input value={v.image ?? ''} onChange={(e) => set('image', e.target.value)} dir="ltr" placeholder="/img/deluxe.jpg" /></Field>
        <Field label={t('rooms.amenities')} hint={t('rooms.amenitiesHint')} className="sm:col-span-2"><Input value={v.amenitiesText} onChange={(e) => set('amenitiesText', e.target.value)} /></Field>
        <Field label={t('common.notes')} optional className="sm:col-span-2"><Textarea value={v.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function RoomDetail({ id, onClose, onEdit, canWrite }: { id: number; onClose: () => void; onEdit: (r: Room) => void; canWrite: boolean }) {
  const { t, money, date } = useI18n(); const { data } = useApi<any>(`/rooms/${id}`)
  return (
    <Modal open onClose={onClose} size="lg" title={data ? `${t('rooms.number')} ${data.number}` : '...'} footer={data && canWrite ? <Button onClick={() => onEdit(data)}><Pencil className="size-4" />{t('common.edit')}</Button> : undefined}>
      {!data ? <Loading /> : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl bg-ink-100">{data.image && <img src={data.image} alt={data.category_name} className="aspect-[4/3] w-full object-cover" />}</div>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={data.status} /><StatusBadge status={data.housekeeping_status} /><Badge>{data.category_name}</Badge></div>
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-ink-500">{t('rooms.price')}</dt><dd className="num font-semibold">{money(data.price)}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('rooms.capacity')}</dt><dd className="num font-semibold">{data.capacity}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('rooms.floor')}</dt><dd className="num font-semibold">{data.floor}</dd></div>
              {data.current_guest && <div><dt className="text-xs text-ink-500">{t('rooms.guest')}</dt><dd className="font-semibold">{data.current_guest}</dd></div>}
            </dl>
            <div><p className="mb-1.5 text-xs text-ink-500">{t('rooms.amenities')}</p><div className="flex flex-wrap gap-1.5">{data.amenities.map((a: string) => <Badge key={a} tone="gold">{a}</Badge>)}</div></div>
            <div><p className="mb-1.5 text-xs text-ink-500">{t('rooms.upcoming')}</p>
              {data.upcoming.length ? <ul className="space-y-1.5">{data.upcoming.map((u: any) => <li key={u.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2"><span className="truncate">{u.guest_name}</span><span className="num text-xs text-ink-500">{date(u.check_in)} → {date(u.check_out)}</span></li>)}</ul> : <p className="text-ink-400">{t('common.none')}</p>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Categories({ onClose }: { onClose: () => void }) {
  const { t, money } = useI18n(); const { data, reload } = useApi<any[]>('/categories'); const toast = useToast()
  const [edit, setEdit] = useState<any | null>(null)
  const [del, setDel] = useState<any | null>(null)
  return (
    <Modal open onClose={onClose} size="lg" title={t('rooms.categories')} footer={<Button variant="primary" onClick={() => setEdit({ name: '', base_price: 0, capacity: 2, amenities: [], description: '' })}><Plus className="size-4" />{t('rooms.addCategory')}</Button>}>
      {!data ? <Loading /> : (
        <ul className="divide-y divide-ink-100">
          {data.map((c) => (
            <li key={c.id} className="flex items-center gap-4 py-3">
              <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-ink-100">{c.image && <img src={c.image} alt="" className="size-full object-cover" />}</div>
              <div className="min-w-0 flex-1"><p className="font-medium text-ink-900">{c.name}</p><p className="text-xs text-ink-500"><span className="num">{money(c.base_price)}</span> · {t('rooms.sleeps', { n: c.capacity })} · {t('rooms.roomCount', { n: c.room_count })}</p></div>
              <IconButton onClick={() => setEdit(c)} aria-label={t('common.edit')}><Pencil className="size-4" /></IconButton><IconButton onClick={() => setDel(c)} aria-label={t('common.delete')}><Trash2 className="size-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
      {edit && <CategoryForm cat={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />}
      <Confirm open={!!del} onClose={() => setDel(null)} title={t('common.delete')} message={del?.name} onConfirm={async () => { try { await api(`/categories/${del.id}`, { method: 'DELETE' }); toast(t('common.deleted')); setDel(null); reload() } catch (e) { toast(errMsg(e), 'err'); setDel(null) } }} />
    </Modal>
  )
}
function CategoryForm({ cat, onClose, onSaved }: { cat: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n(); const toast = useToast()
  const [v, setV] = useState({ ...cat, amenitiesText: (cat.amenities ?? []).join(', ') }); const [errs, setErrs] = useState<Record<string, string>>({})
  const set = (k: string, val: any) => setV((s: any) => ({ ...s, [k]: val }))
  const save = async () => {
    const body = { name: v.name, description: v.description ?? '', base_price: v.base_price, capacity: v.capacity, image: v.image || null, amenities: v.amenitiesText.split(',').map((s: string) => s.trim()).filter(Boolean) }
    try { cat.id ? await api(`/categories/${cat.id}`, { method: 'PUT', body }) : await api('/categories', { body }); toast(t('common.saved')); onSaved() } catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') }
  }
  return (
    <Modal open onClose={onClose} title={cat.id ? t('rooms.editCategory') : t('rooms.addCategory')} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.name')} error={errs.name}><Input value={v.name} onChange={(e) => set('name', e.target.value)} error={!!errs.name} /></Field>
        <Field label={t('rooms.basePrice')} error={errs.base_price}><Input type="number" min={0} value={v.base_price} onChange={(e) => set('base_price', e.target.value)} /></Field>
        <Field label={t('rooms.capacity')} error={errs.capacity}><Input type="number" min={1} value={v.capacity} onChange={(e) => set('capacity', e.target.value)} /></Field>
        <Field label={t('rooms.image')} optional><Input value={v.image ?? ''} onChange={(e) => set('image', e.target.value)} dir="ltr" /></Field>
        <Field label={t('rooms.amenities')} hint={t('rooms.amenitiesHint')} className="sm:col-span-2"><Input value={v.amenitiesText} onChange={(e) => set('amenitiesText', e.target.value)} /></Field>
        <Field label={t('common.description')} optional className="sm:col-span-2"><Textarea value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
