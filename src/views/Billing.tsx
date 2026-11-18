import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileDown, Plus, Undo2, Wallet, Trash2 } from 'lucide-react'
import { api, qs, useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/format'
import { Button, Card, DataTable, ErrorState, Field, Input, Loading, Modal, PageHeader, Pagination, SearchInput, Select, StatCard, StatusBadge, cx, errMsg, fieldErrors, useToast } from '@/components/ui'
import { PaymentModal } from '@/components/Payment'

const ITEM_TYPES = ['service', 'food', 'minibar', 'laundry', 'spa', 'transport', 'room', 'other']

export default function Billing() {
  const { t, money, date } = useI18n(); const { can } = useAuth(); const w = can('billing', 'write')
  const [sp, setSp] = useSearchParams()
  const [f, setF] = useState({ q: '', state: '', page: 1, sort: 'issued_at', dir: 'desc' })
  const { data, error, loading, reload } = useApi<any>('/invoices' + qs({ ...f, pageSize: 15 }))
  const [open, setOpen] = useState<number | null>(sp.get('open') ? +sp.get('open')! : null)
  const close = () => { setOpen(null); if (sp.get('open')) { sp.delete('open'); setSp(sp, { replace: true }) }; reload() }
  return (
    <div>
      <PageHeader title={t('bill.title')} subtitle={t('bill.subtitle')} />
      {data?.sums && <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label={t('bill.totalInvoiced')} value={money(data.sums.total)} />
        <StatCard label={t('bill.totalPaid')} value={money(data.sums.paid)} tone="green" />
        <StatCard label={t('bill.totalOutstanding')} value={money(data.sums.outstanding)} tone="red" />
      </div>}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={f.q} onChange={(v) => setF({ ...f, q: v, page: 1 })} />
          <Select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, page: 1 })} className="w-48"><option value="">{t('common.status')}: {t('common.all')}</option><option value="outstanding">{t('bill.outstandingOnly')}</option>{['paid', 'partial', 'unpaid', 'void'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}</Select>
        </div>
        {loading && !data ? <Loading /> : error ? <ErrorState error={error} retry={reload} /> : (<>
          <DataTable<any> rows={data.data} sort={f.sort} dir={f.dir as any} onSort={(s) => setF((x) => ({ ...x, sort: s, dir: x.sort === s && x.dir === 'asc' ? 'desc' : 'asc' }))} onRow={(r) => setOpen(r.id)} cols={[
            { key: 'number', header: t('bill.number'), sort: 'number', render: (r) => <b className="num">{r.number}</b> },
            { key: 'guest', header: t('res.guest'), sort: 'guest_name', render: (r) => r.guest_name },
            { key: 'date', header: t('bill.issued'), sort: 'issued_at', render: (r) => <span className="tabular-nums">{date(r.issued_at)}</span>, hideOnMobile: true },
            { key: 'total', header: t('common.total'), render: (r) => <span className="num">{money(r.total)}</span> },
            { key: 'paid', header: t('bill.paid'), sort: 'paid', render: (r) => <span className="num">{money(r.paid)}</span>, hideOnMobile: true },
            { key: 'bal', header: t('bill.balance'), render: (r) => <span className={cx('num', r.balance > 0.004 && r.state !== 'void' && 'font-semibold text-rose-600')}>{money(r.balance)}</span> },
            { key: 'state', header: t('common.status'), render: (r) => <StatusBadge status={r.state} /> },
          ]} />
          <Pagination page={f.page} pageSize={15} total={data.total} onPage={(p) => setF((x) => ({ ...x, page: p }))} />
        </>)}
      </Card>
      {open !== null && <InvoiceDetail id={open} onClose={close} w={w} />}
    </div>
  )
}

async function makePdf(inv: any, hotel: string, cur: string, receipt: boolean, t: (k: string) => string) {
  const [{ jsPDF }, at] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF(); const m = (n: number) => fmtMoney(n, cur)
  doc.setFontSize(20); doc.text(hotel, 14, 20); doc.setFontSize(11)
  doc.text(`${receipt ? 'Receipt' : 'Invoice'} ${inv.number}`, 14, 30); doc.text(`Guest: ${inv.guest?.name ?? inv.guest_name ?? ''}`, 14, 37); doc.text(`Date: ${String(inv.issued_at).slice(0, 10)}`, 14, 44)
  ;(at.default ?? (at as any).autoTable)(doc, { startY: 52, head: [['Description', 'Qty', 'Unit', 'Amount']], body: inv.items.map((i: any) => [i.description, i.quantity, m(i.unit_price), m(i.quantity * i.unit_price)]), headStyles: { fillColor: [14, 26, 43] } })
  let y = (doc as any).lastAutoTable.finalY + 10
  const rows: [string, string][] = [['Subtotal', m(inv.subtotal)], ...(inv.discount > 0 ? [['Discount', '-' + m(inv.discount)] as [string, string]] : []), [`Service (${inv.service_rate}%)`, m(inv.service)], [`Tax (${inv.tax_rate}%)`, m(inv.tax)], ['Total', m(inv.total)], ['Paid', m(inv.paid)], ['Balance', m(inv.balance)]]
  rows.forEach(([a, b]) => { doc.text(a, 130, y); doc.text(b, 196, y, { align: 'right' }); y += 7 })
  doc.save(`${receipt ? 'receipt' : 'invoice'}-${inv.number}.pdf`)
}

function InvoiceDetail({ id, onClose, w }: { id: number; onClose: () => void; w: boolean }) {
  const { t, money, dt } = useI18n(); const { settings } = useAuth(); const toast = useToast()
  const { data: inv, reload, error } = useApi<any>('/invoices/' + id)
  const [pay, setPay] = useState<null | 'pay' | 'refund'>(null); const [chg, setChg] = useState(false)
  const delItem = async (itemId: number) => { try { await api(`/invoices/${id}/items/${itemId}`, { method: 'DELETE' }); reload() } catch (e) { toast(errMsg(e), 'err') } }
  const voidIt = async () => { if (!confirm(t('bill.voidConfirm'))) return; try { await api('/invoices/' + id, { method: 'PUT', body: { status: 'void' } }); reload() } catch (e) { toast(errMsg(e), 'err') } }
  const pdf = (rc: boolean) => makePdf(inv, settings.hotel_name ?? 'Hotelna', settings.currency ?? 'EGP', rc, t as any)
  return (
    <Modal open onClose={onClose} size="lg" title={inv ? <span className="flex items-center gap-3">{inv.number}<StatusBadge status={inv.state} /></span> : '...'} footer={inv ? <>
      <Button onClick={() => pdf(false)}><FileDown className="size-4" />{t('bill.print')}</Button>
      {inv.paid > 0 && <Button onClick={() => pdf(true)}><FileDown className="size-4" />{t('bill.receipt')}</Button>}
      {w && inv.state !== 'void' && <>
        <Button onClick={() => setChg(true)}><Plus className="size-4" />{t('bill.addCharge')}</Button>
        {inv.paid > 0 && <Button onClick={() => setPay('refund')}><Undo2 className="size-4" />{t('bill.refund')}</Button>}
        {inv.balance > 0.004 && <Button variant="primary" onClick={() => setPay('pay')}><Wallet className="size-4" />{t('bill.addPayment')}</Button>}
        <Button variant="danger" onClick={voidIt}>{t('bill.void')}</Button></>}
    </> : undefined}>
      {error ? <ErrorState error={error} /> : !inv ? <Loading /> : (
        <div className="space-y-5 text-sm">
          <p className="text-ink-500">{t('bill.billTo')}: <b className="text-ink-900">{inv.guest?.name}</b></p>
          <table className="w-full"><thead><tr className="border-b border-ink-100 text-xs text-ink-500"><th className="py-2 text-start font-medium">{t('common.description')}</th><th className="text-start font-medium">{t('bill.qty')}</th><th className="text-start font-medium">{t('bill.unit')}</th><th className="text-end font-medium">{t('common.amount')}</th><th /></tr></thead>
            <tbody>{inv.items.map((i: any) => <tr key={i.id} className="border-b border-ink-50"><td className="py-2">{i.description}</td><td className="num">{i.quantity}</td><td className="num">{money(i.unit_price)}</td><td className="num text-end">{money(i.quantity * i.unit_price)}</td><td className="w-8 text-end">{w && i.type !== 'room' && inv.state !== 'void' && <button onClick={() => delItem(i.id)} className="text-ink-400 hover:text-rose-600" aria-label={t('common.delete')}><Trash2 className="size-3.5" /></button>}</td></tr>)}</tbody></table>
          <dl className="ms-auto w-full max-w-xs space-y-1.5">
            <div className="flex justify-between"><dt className="text-ink-500">{t('bill.subtotal')}</dt><dd className="num">{money(inv.subtotal)}</dd></div>
            {inv.discount > 0 && <div className="flex justify-between"><dt className="text-ink-500">{t('bill.discount')}</dt><dd className="num">-{money(inv.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-500">{t('bill.service')} ({inv.service_rate}%)</dt><dd className="num">{money(inv.service)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">{t('bill.tax')} ({inv.tax_rate}%)</dt><dd className="num">{money(inv.tax)}</dd></div>
            <div className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><dt>{t('common.total')}</dt><dd className="num">{money(inv.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">{t('bill.paid')}</dt><dd className="num text-emerald-600">{money(inv.paid)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>{t('bill.balance')}</dt><dd className={cx('num', inv.balance > 0.004 && 'text-rose-600')}>{money(inv.balance)}</dd></div>
          </dl>
          <div><p className="mb-2 font-semibold">{t('bill.payments')}</p>
            {inv.payments.length === 0 ? <p className="text-ink-500">{t('bill.noPayments')}</p> : <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">{inv.payments.map((p: any) => <li key={p.id} className="flex items-center justify-between px-3 py-2"><span>{t('method.' + p.method)} <span className="num text-xs text-ink-500">· {dt(p.created_at)}{p.reference ? ` · ${p.reference}` : ''}</span></span><b className={cx('num', p.kind === 'refund' ? 'text-rose-600' : 'text-emerald-600')}>{p.kind === 'refund' ? '-' : ''}{money(p.amount)}</b></li>)}</ul>}
          </div>
        </div>
      )}
      {pay && inv && <PaymentModal invoiceId={id} number={inv.number} balance={inv.balance} paid={inv.paid} refund={pay === 'refund'} onClose={() => setPay(null)} onDone={() => { setPay(null); reload() }} />}
      {chg && <ChargeModal id={id} onClose={() => setChg(false)} onDone={() => { setChg(false); reload() }} />}
    </Modal>
  )
}

function ChargeModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n(); const toast = useToast()
  const [v, setV] = useState<any>({ type: 'service', quantity: 1, unit_price: '' }); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false)
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const save = async () => { setBusy(true); setErrs({}); try { await api(`/invoices/${id}/items`, { body: { type: v.type, description: v.description, quantity: Number(v.quantity), unit_price: Number(v.unit_price) } }); toast(t('common.saved')); onDone() } catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) } }
  return (
    <Modal open onClose={onClose} size="sm" title={t('bill.addCharge')} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <div className="space-y-4">
        <Field label={t('common.type')}><Select value={v.type} onChange={(e) => set('type', e.target.value)}>{ITEM_TYPES.map((x) => <option key={x} value={x}>{t('bill.itemType.' + x)}</option>)}</Select></Field>
        <Field label={t('common.description')} error={errs.description}><Input value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} error={!!errs.description} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-4"><Field label={t('bill.qty')} error={errs.quantity}><Input type="number" min={1} value={v.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field><Field label={t('bill.unit')} error={errs.unit_price}><Input type="number" min={0} value={v.unit_price} onChange={(e) => set('unit_price', e.target.value)} error={!!errs.unit_price} /></Field></div>
      </div>
    </Modal>
  )
}
