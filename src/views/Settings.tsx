import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api, useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Badge, Button, Card, DataTable, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Tabs, errMsg, fieldErrors, useToast } from '@/components/ui'

const ROLES = ['admin', 'manager', 'front_desk', 'housekeeping', 'accountant']
const CURRENCIES: [string, string][] = [['EGP', 'EGP'], ['USD', '$'], ['EUR', '€'], ['SAR', 'SAR'], ['AED', 'AED'], ['GBP', '£']]

export default function Settings() {
  const { t } = useI18n(); const { user, settings } = useAuth()
  const admin = user?.role === 'admin'
  const [tab, setTab] = useState<'hotel' | 'pricing' | 'users' | 'account'>('hotel')
  const tabs = [{ id: 'hotel' as const, label: t('set.hotel') }, { id: 'pricing' as const, label: t('set.pricing') }, ...(admin ? [{ id: 'users' as const, label: t('set.users') }] : []), { id: 'account' as const, label: t('set.account') }]
  return (
    <div>
      <PageHeader title={t('set.title')} subtitle={t('set.subtitle')} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'hotel' || tab === 'pricing' ? (settings.currency ? <SettingsForm key={tab + settings.currency + settings.hotel_name} kind={tab} admin={!!admin} /> : <Loading />) : tab === 'users' ? <Users /> : <Account />}
    </div>
  )
}

function SettingsForm({ kind, admin }: { kind: 'hotel' | 'pricing'; admin: boolean }) {
  const { t, setLang } = useI18n(); const { settings, reloadSettings } = useAuth(); const toast = useToast()
  const [v, setV] = useState<any>({ ...settings }); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({})
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const keys = kind === 'hotel' ? ['hotel_name', 'hotel_address', 'hotel_phone', 'hotel_email', 'checkin_time', 'checkout_time', 'star_rating', 'default_language'] : ['currency', 'currency_symbol', 'tax_rate', 'service_rate', 'weekend_markup']
  const save = async () => {
    setBusy(true); setErrs({})
    const body: any = {}; keys.forEach((k) => { body[k] = ['tax_rate', 'service_rate', 'weekend_markup', 'star_rating'].includes(k) ? Number(v[k]) : v[k] })
    try { await api('/settings', { method: 'PUT', body }); reloadSettings(); toast(t('common.saved')) } catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  const F = (k: string, label: string, props: any = {}) => <Field label={label} error={errs[k]}><Input value={v[k] ?? ''} onChange={(e) => set(k, e.target.value)} disabled={!admin} {...props} /></Field>
  return (
    <Card className="max-w-3xl p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === 'hotel' ? <>
          {F('hotel_name', t('set.hotelName'))}{F('hotel_email', t('common.email'), { dir: 'ltr' })}{F('hotel_phone', t('common.phone'), { dir: 'ltr' })}{F('star_rating', t('set.stars'), { type: 'number', min: 1, max: 5 })}
          <div className="sm:col-span-2">{F('hotel_address', t('guest.address'), { dir: 'auto' })}</div>
          {F('checkin_time', t('set.checkinTime'), { type: 'time' })}{F('checkout_time', t('set.checkoutTime'), { type: 'time' })}
          <Field label={t('set.language')}><Select value={v.default_language ?? 'en'} disabled={!admin} onChange={(e) => set('default_language', e.target.value)}><option value="en">English</option><option value="ar">العربية</option></Select></Field>
        </> : <>
          <Field label={t('set.currency')}><Select value={v.currency} disabled={!admin} onChange={(e) => { set('currency', e.target.value); set('currency_symbol', CURRENCIES.find((c) => c[0] === e.target.value)?.[1] ?? e.target.value) }}>{CURRENCIES.map(([c]) => <option key={c} value={c}>{c}</option>)}</Select></Field>
          {F('tax_rate', t('set.tax'), { type: 'number', min: 0, step: 1 })}{F('service_rate', t('set.service'), { type: 'number', min: 0, step: 1 })}{F('weekend_markup', t('set.weekend'), { type: 'number', min: 0, step: 1 })}
        </>}
      </div>
      {admin ? <div className="mt-6 flex justify-end gap-2">{kind === 'hotel' && <Button onClick={() => setLang(v.default_language)}>{t('set.applyLang')}</Button>}<Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></div> : <p className="mt-4 text-xs text-ink-500">{t('set.adminOnly')}</p>}
    </Card>
  )
}

function Users() {
  const { t } = useI18n(); const { user } = useAuth()
  const { data, error, loading, reload } = useApi<any>('/users'); const [form, setForm] = useState<any>(null)
  return (
    <Card>
      <div className="flex justify-end border-b border-ink-100 p-4"><Button variant="primary" onClick={() => setForm({ role: 'front_desk', active: 1 })}><Plus className="size-4" />{t('set.addUser')}</Button></div>
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (
        <DataTable<any> rows={data.users} onRow={(r) => setForm(r)} cols={[
          { key: 'n', header: t('common.name'), render: (r) => <span className="font-medium text-ink-900">{r.name}{r.id === user?.id ? ' ·' : ''}</span> },
          { key: 'e', header: t('common.email'), render: (r) => <span dir="ltr">{r.email}</span>, hideOnMobile: true },
          { key: 'r', header: t('set.role'), render: (r) => <Badge tone="gold">{t('role.' + r.role)}</Badge> },
          { key: 'a', header: t('common.status'), render: (r) => <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? t('status.active') : t('set.disabled')}</Badge> },
        ]} />
      )}
      {form && <UserForm u={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload() }} />}
    </Card>
  )
}

function UserForm({ u, onClose, onSaved }: { u: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n(); const toast = useToast(); const editing = !!u.id
  const [v, setV] = useState<any>({ ...u, password: '' }); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false)
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const save = async () => {
    setBusy(true); setErrs({})
    const body: any = { name: v.name, email: v.email, role: v.role, active: v.active ? 1 : 0 }; if (v.password) body.password = v.password
    try { await api(editing ? '/users/' + u.id : '/users', { method: editing ? 'PUT' : 'POST', body }); toast(t('common.saved')); onSaved() } catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="sm" title={editing ? t('common.edit') : t('set.addUser')} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <div className="space-y-4">
        <Field label={t('common.name')} error={errs.name}><Input value={v.name ?? ''} onChange={(e) => set('name', e.target.value)} error={!!errs.name} /></Field>
        <Field label={t('common.email')} error={errs.email}><Input dir="ltr" type="email" value={v.email ?? ''} onChange={(e) => set('email', e.target.value)} error={!!errs.email} /></Field>
        <Field label={t('set.role')}><Select value={v.role} onChange={(e) => set('role', e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{t('role.' + r)}</option>)}</Select></Field>
        <Field label={editing ? t('set.newPassword') : t('set.password')} error={errs.password} optional={editing}><Input dir="ltr" type="password" value={v.password} onChange={(e) => set('password', e.target.value)} error={!!errs.password} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v.active} onChange={(e) => set('active', e.target.checked ? 1 : 0)} className="size-4 accent-gold-500" />{t('status.active')}</label>
      </div>
    </Modal>
  )
}

function Account() {
  const { t } = useI18n(); const { user } = useAuth(); const toast = useToast()
  const [v, setV] = useState({ current: '', next: '' }); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false)
  const save = async () => { setBusy(true); setErrs({}); try { await api('/auth/password', { body: v }); setV({ current: '', next: '' }); toast(t('common.saved')) } catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) } }
  return (
    <Card className="max-w-md p-6">
      <p className="mb-1 font-semibold">{user?.name}</p><p className="mb-5 text-sm text-ink-500">{user?.email} · {t('role.' + user?.role)}</p>
      <div className="space-y-4">
        <Field label={t('set.currentPassword')} error={errs.current}><Input type="password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} error={!!errs.current} /></Field>
        <Field label={t('set.newPassword')} error={errs.next}><Input type="password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} error={!!errs.next} /></Field>
        <Button variant="primary" loading={busy} onClick={save}>{t('set.changePassword')}</Button>
      </div>
    </Card>
  )
}
