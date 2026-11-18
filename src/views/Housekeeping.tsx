import { useState } from 'react'
import { Play, Check, Plus, Sparkles, Trash2, Wrench } from 'lucide-react'
import { api, qs, useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { todayISO } from '@/lib/format'
import { Button, Card, DataTable, ErrorState, Field, Input, Loading, Modal, PageHeader, Pagination, SearchInput, Select, StatusBadge, Tabs, Textarea, errMsg, fieldErrors, useToast } from '@/components/ui'

const TYPES = ['cleaning', 'checkout_cleaning', 'deep_cleaning', 'turndown', 'inspection', 'laundry']
const PRIO = ['low', 'normal', 'high', 'urgent']

export default function Housekeeping() {
  const { t } = useI18n(); const { can } = useAuth(); const w = can('housekeeping', 'write')
  const [tab, setTab] = useState<'tasks' | 'maint'>('tasks'); const [form, setForm] = useState<'task' | 'maint' | null>(null); const [tick, setTick] = useState(0); const toast = useToast()
  const gen = async () => { try { const r: any = await api('/housekeeping/generate', { body: {} }); toast(t('hk.generated', { n: r.created ?? r.count ?? 0 })); setTick((x) => x + 1) } catch (e) { toast(errMsg(e), 'err') } }
  return (
    <div>
      <PageHeader title={t('hk.title')} subtitle={t('hk.subtitle')} actions={w && <>
        {tab === 'tasks' && <Button onClick={gen}><Sparkles className="size-4" />{t('hk.generate')}</Button>}
        <Button variant="primary" onClick={() => setForm(tab === 'tasks' ? 'task' : 'maint')}><Plus className="size-4" />{tab === 'tasks' ? t('hk.newTask') : t('hk.newMaint')}</Button></>} />
      <Tabs tabs={[{ id: 'tasks', label: t('hk.tasks') }, { id: 'maint', label: t('hk.maintenance') }]} value={tab} onChange={setTab} />
      {tab === 'tasks' ? <Tasks key={tick} w={w} /> : <Maint key={tick} w={w} />}
      {form && <TaskForm kind={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); setTick((x) => x + 1) }} />}
    </div>
  )
}

function Tasks({ w }: { w: boolean }) {
  const { t, date } = useI18n(); const toast = useToast()
  const [f, setF] = useState({ q: '', status: '', date: '', page: 1, sort: 'scheduled_for', dir: 'desc' })
  const { data, error, loading, reload } = useApi<any>('/housekeeping/tasks' + qs({ ...f, pageSize: 12 }))
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v, page: 1 }))
  const upd = async (id: number, status: string) => { try { await api('/housekeeping/tasks/' + id, { method: 'PUT', body: { status } }); reload() } catch (e) { toast(errMsg(e), 'err') } }
  const del = async (id: number) => { try { await api('/housekeeping/tasks/' + id, { method: 'DELETE' }); reload() } catch (e) { toast(errMsg(e), 'err') } }
  const cnt = (s: string) => data?.summary?.find((x: any) => x.status === s)?.n ?? 0
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
        <SearchInput value={f.q} onChange={(v) => set('q', v)} />
        <Select value={f.status} onChange={(e) => set('status', e.target.value)} className="w-44">{[''].map(() => <option key="" value="">{t('common.status')}: {t('common.all')}</option>)}{['pending', 'in_progress', 'completed'].map((s) => <option key={s} value={s}>{t('status.' + s)} ({cnt(s)})</option>)}</Select>
        <Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} className="w-44" />
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (<>
        <DataTable<any> rows={data.data} sort={f.sort} dir={f.dir as any} onSort={(s) => setF((x) => ({ ...x, sort: s, dir: x.sort === s && x.dir === 'asc' ? 'desc' : 'asc' }))} cols={[
          { key: 'room', header: t('res.room'), sort: 'room_number', render: (r) => <b className="num">{r.room_number}</b> },
          { key: 'type', header: t('common.type'), render: (r) => t('hk.type.' + r.type) },
          { key: 'staff', header: t('hk.assignee'), render: (r) => r.staff_name ?? '—', hideOnMobile: true },
          { key: 'prio', header: t('hk.priority'), sort: 'priority', render: (r) => <StatusBadge status={r.priority} /> },
          { key: 'date', header: t('hk.scheduled'), sort: 'scheduled_for', render: (r) => <span className="num">{date(r.scheduled_for)}</span>, hideOnMobile: true },
          { key: 'status', header: t('common.status'), sort: 'status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'act', header: '', render: (r) => w && <span className="flex justify-end gap-1">
            {r.status === 'pending' && <Button size="sm" onClick={() => upd(r.id, 'in_progress')}><Play className="size-3.5" />{t('hk.start')}</Button>}
            {r.status === 'in_progress' && <Button size="sm" variant="primary" onClick={() => upd(r.id, 'completed')}><Check className="size-3.5" />{t('hk.done')}</Button>}
            {r.status !== 'completed' && <Button size="sm" variant="ghost" onClick={() => del(r.id)} aria-label={t('common.delete')}><Trash2 className="size-3.5" /></Button>}</span> },
        ]} />
        <Pagination page={f.page} pageSize={12} total={data.total} onPage={(p) => setF((x) => ({ ...x, page: p }))} />
      </>)}
    </Card>
  )
}

function Maint({ w }: { w: boolean }) {
  const { t, date } = useI18n(); const toast = useToast()
  const [f, setF] = useState({ q: '', status: '', page: 1 })
  const { data, error, loading, reload } = useApi<any>('/maintenance' + qs({ ...f, pageSize: 12 }))
  const upd = async (id: number, status: string) => { try { await api('/maintenance/' + id, { method: 'PUT', body: { status } }); reload() } catch (e) { toast(errMsg(e), 'err') } }
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
        <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v, page: 1 })} />
        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })} className="w-44"><option value="">{t('common.status')}: {t('common.all')}</option>{['open', 'in_progress', 'resolved'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}</Select>
      </div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (<>
        <DataTable<any> rows={data.data} cols={[
          { key: 'room', header: t('res.room'), render: (r) => <b className="num">{r.room_number ?? '—'}</b> },
          { key: 'title', header: t('hk.issue'), render: (r) => <span className="flex items-center gap-1.5"><Wrench className="size-3.5 text-ink-400" />{r.title}</span> },
          { key: 'prio', header: t('hk.priority'), render: (r) => <StatusBadge status={r.priority} /> },
          { key: 'date', header: t('hk.reported'), render: (r) => <span className="num">{date(r.created_at)}</span>, hideOnMobile: true },
          { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
          { key: 'act', header: '', render: (r) => w && <span className="flex justify-end gap-1">
            {r.status === 'open' && <Button size="sm" onClick={() => upd(r.id, 'in_progress')}>{t('hk.start')}</Button>}
            {r.status !== 'resolved' && <Button size="sm" variant="primary" onClick={() => upd(r.id, 'resolved')}><Check className="size-3.5" />{t('hk.resolve')}</Button>}</span> },
        ]} />
        <Pagination page={f.page} pageSize={12} total={data.total} onPage={(p) => setF((x) => ({ ...x, page: p }))} />
      </>)}
    </Card>
  )
}

function TaskForm({ kind, onClose, onSaved }: { kind: 'task' | 'maint'; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n(); const toast = useToast()
  const [v, setV] = useState<any>({ type: 'cleaning', priority: 'normal', scheduled_for: todayISO() }); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false)
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const { data: rooms } = useApi<any>('/rooms' + qs({ pageSize: 200, sort: 'number', dir: 'asc' }))
  const { data: staff } = useApi<any>('/staff' + qs({ pageSize: 100, status: 'active' }))
  const save = async () => {
    setBusy(true); setErrs({})
    const n = (x: any) => (x === '' || x == null ? undefined : +x)
    const body = kind === 'task' ? { room_id: n(v.room_id), type: v.type, assigned_to: n(v.assigned_to), priority: v.priority, scheduled_for: v.scheduled_for, notes: v.notes ?? '' } : { room_id: n(v.room_id), title: v.title, description: v.description ?? '', priority: v.priority, assigned_to: n(v.assigned_to) }
    try { await api(kind === 'task' ? '/housekeeping/tasks' : '/maintenance', { body }); toast(t('common.saved')); onSaved() } catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="md" title={kind === 'task' ? t('hk.newTask') : t('hk.newMaint')} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('res.room')} error={errs.room_id}><Select value={v.room_id ?? ''} onChange={(e) => set('room_id', e.target.value)} error={!!errs.room_id}><option value="">—</option>{(rooms?.data ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.number} · {r.category_name}</option>)}</Select></Field>
        <Field label={t('hk.priority')}><Select value={v.priority} onChange={(e) => set('priority', e.target.value)}>{PRIO.map((p) => <option key={p} value={p}>{t('priority.' + p)}</option>)}</Select></Field>
        {kind === 'task' ? <>
          <Field label={t('common.type')}><Select value={v.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((x) => <option key={x} value={x}>{t('hk.type.' + x)}</option>)}</Select></Field>
          <Field label={t('hk.scheduled')} error={errs.scheduled_for}><Input type="date" value={v.scheduled_for} onChange={(e) => set('scheduled_for', e.target.value)} /></Field>
        </> : <Field label={t('hk.issue')} error={errs.title} className="sm:col-span-2"><Input value={v.title ?? ''} onChange={(e) => set('title', e.target.value)} error={!!errs.title} /></Field>}
        <Field label={t('hk.assignee')} optional className="sm:col-span-2"><Select value={v.assigned_to ?? ''} onChange={(e) => set('assigned_to', e.target.value)}><option value="">—</option>{(staff?.data ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name} · {s.position}</option>)}</Select></Field>
        <Field label={t('common.notes')} optional className="sm:col-span-2"><Textarea value={(kind === 'task' ? v.notes : v.description) ?? ''} onChange={(e) => set(kind === 'task' ? 'notes' : 'description', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
