import { useState } from 'react'
import { FileUp, Pencil, Plus, Star } from 'lucide-react'
import { api, qs, useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Badge, Button, Card, DataTable, ErrorState, Field, Input, Loading, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Textarea, errMsg, fieldErrors, useToast } from '@/components/ui'

export function GuestForm({ guest, onClose, onSaved }: { guest: any; onClose: () => void; onSaved: (id?: number) => void }) {
  const { t } = useI18n(); const toast = useToast(); const editing = !!guest.id
  const [v, setV] = useState<any>({ id_type: 'passport', vip: 0, ...guest }); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false)
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const upload = (f?: File) => { if (!f) return; if (f.size > 250000) return toast('Max 250 KB', 'err'); const r = new FileReader(); r.onload = () => set('id_document', r.result as string); r.readAsDataURL(f) }
  const save = async () => {
    setBusy(true); setErrs({})
    const { id, stays, total_spent, created_at, ...body } = v
    try { const r: any = editing ? await api('/guests/' + guest.id, { method: 'PUT', body: { ...body, vip: body.vip ? 1 : 0 } }) : await api('/guests', { body: { ...body, vip: body.vip ? 1 : 0 } }); toast(t('common.saved')); onSaved(editing ? guest.id : r.id) }
    catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="lg" title={editing ? t('guest.editTitle') : t('guest.newTitle')} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.name')} error={errs.name}><Input value={v.name ?? ''} onChange={(e) => set('name', e.target.value)} error={!!errs.name} autoFocus /></Field>
        <Field label={t('common.phone')} error={errs.phone} optional><Input value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} dir="ltr" /></Field>
        <Field label={t('common.email')} error={errs.email} optional><Input type="email" value={v.email ?? ''} onChange={(e) => set('email', e.target.value)} error={!!errs.email} dir="ltr" /></Field>
        <Field label={t('guest.nationality')} optional><Input value={v.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} /></Field>
        <Field label={t('guest.idType')}><Select value={v.id_type ?? 'passport'} onChange={(e) => set('id_type', e.target.value)}><option value="passport">{t('guest.passport')}</option><option value="national_id">ID</option><option value="driver_license">License</option></Select></Field>
        <Field label={t('guest.idNumber')} optional><Input value={v.id_number ?? ''} onChange={(e) => set('id_number', e.target.value)} dir="ltr" /></Field>
        <Field label={t('guest.address')} optional className="sm:col-span-2"><Input value={v.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label={t('guest.prefs')} optional className="sm:col-span-2"><Textarea value={v.preferences ?? ''} onChange={(e) => set('preferences', e.target.value)} /></Field>
        <Field label={t('guest.idDoc')} optional>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50"><FileUp className="size-4" />{v.id_document ? '✓' : t('guest.uploadId')}<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={!!v.vip} onChange={(e) => set('vip', e.target.checked ? 1 : 0)} className="size-4 accent-gold-500" />{t('guest.vip')}</label>
      </div>
    </Modal>
  )
}

export default function Guests() {
  const { t, money, date } = useI18n(); const { can } = useAuth(); const w = can('guests', 'write')
  const [f, setF] = useState({ q: '', vip: '', page: 1, sort: 'name', dir: 'asc' })
  const { data, error, loading, reload } = useApi<any>('/guests' + qs({ ...f, pageSize: 15 }))
  const [form, setForm] = useState<any>(null); const [open, setOpen] = useState<number | null>(null)
  return (
    <div>
      <PageHeader title={t('guest.title')} subtitle={t('guest.subtitle')} actions={w && <Button variant="primary" onClick={() => setForm({})}><Plus className="size-4" />{t('guest.add')}</Button>} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v, page: 1 })} />
          <Button size="sm" variant={f.vip ? 'gold' : 'secondary'} onClick={() => setF({ ...f, vip: f.vip ? '' : '1', page: 1 })}><Star className="size-3.5" />{t('guest.vipOnly')}</Button>
        </div>
        {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (<>
          <DataTable<any> rows={data.data} sort={f.sort} dir={f.dir as any} onSort={(s) => setF((x) => ({ ...x, sort: s, dir: x.sort === s && x.dir === 'asc' ? 'desc' : 'asc' }))} onRow={(r) => setOpen(r.id)} cols={[
            { key: 'name', header: t('common.name'), sort: 'name', render: (r) => <span className="flex items-center gap-1.5 font-medium text-ink-900">{r.name}{r.vip ? <Star className="size-3 fill-gold-500 text-gold-500" /> : null}</span> },
            { key: 'phone', header: t('common.phone'), render: (r) => <span className="num">{r.phone}</span>, hideOnMobile: true },
            { key: 'nat', header: t('guest.nationality'), sort: 'nationality', render: (r) => r.nationality, hideOnMobile: true },
            { key: 'stays', header: t('guest.stays'), sort: 'stays', render: (r) => <span className="num">{r.stays}</span> },
            { key: 'last', header: t('guest.lastStay'), sort: 'last_stay', render: (r) => <span className="num">{r.last_stay ? date(r.last_stay) : '—'}</span>, hideOnMobile: true },
            { key: 'spent', header: t('guest.spent'), sort: 'total_spent', render: (r) => <span className="num">{money(r.total_spent)}</span> },
          ]} />
          <Pagination page={f.page} pageSize={15} total={data.total} onPage={(p) => setF((x) => ({ ...x, page: p }))} />
        </>)}
      </Card>
      {form && <GuestForm guest={form} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); reload(); if (id) setOpen(id) }} />}
      {open !== null && <Profile id={open} canWrite={w} onClose={() => setOpen(null)} onEdit={(g) => { setOpen(null); setForm(g) }} />}
    </div>
  )
}

function Profile({ id, onClose, onEdit, canWrite }: { id: number; onClose: () => void; onEdit: (g: any) => void; canWrite: boolean }) {
  const { t, money, date } = useI18n()
  const { data: g, error } = useApi<any>('/guests/' + id)
  return (
    <Modal open onClose={onClose} size="lg" title={g ? <span className="flex items-center gap-2">{g.name}{g.vip ? <Badge tone="gold"><Star className="size-3 fill-current" />VIP</Badge> : null}</span> : '...'} footer={g && canWrite ? <Button onClick={() => onEdit(g)}><Pencil className="size-4" />{t('common.edit')}</Button> : undefined}>
      {error ? <ErrorState error={error} /> : !g ? <Loading /> : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-ink-500">{t('common.phone')}</dt><dd className="num font-medium">{g.phone || '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('common.email')}</dt><dd className="break-all font-medium">{g.email || '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('guest.nationality')}</dt><dd className="font-medium">{g.nationality || '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('guest.idNumber')}</dt><dd className="num font-medium">{g.id_number || '—'}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('guest.spent')}</dt><dd className="num font-semibold">{money(g.total_spent)}</dd></div>
              <div><dt className="text-xs text-ink-500">{t('guest.since')}</dt><dd className="num font-medium">{date(g.created_at)}</dd></div>
            </dl>
            {g.preferences && <p className="rounded-lg bg-gold-100 px-3 py-2 text-gold-600"><b>{t('guest.prefs')}:</b> {g.preferences}</p>}
            {g.id_document && <img src={g.id_document} alt="ID" className="max-h-40 rounded-lg border border-ink-100" />}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">{t('guest.history')}</p>
            {g.stays.length === 0 ? <p className="text-sm text-ink-500">{t('guest.noStays')}</p> : <ul className="max-h-72 divide-y divide-ink-100 overflow-auto rounded-xl border border-ink-100 text-sm">{g.stays.map((s: any) => <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2"><span><b className="num">{s.code}</b><br /><span className="num text-xs text-ink-500">{date(s.check_in)} → {date(s.check_out)} · {s.room_number}</span></span><span className="text-end"><StatusBadge status={s.status} /><br /><span className="num text-xs">{money(s.total)}</span></span></li>)}</ul>}
          </div>
        </div>
      )}
    </Modal>
  )
}
