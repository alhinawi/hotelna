import { useState } from 'react'
import { api } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Button, Field, Input, Modal, Select, errMsg, fieldErrors, useToast } from './ui'

const METHODS = ['cash', 'card', 'bank_transfer', 'mobile_wallet', 'online']
export function PaymentModal({ invoiceId, number, balance, paid, refund = false, onClose, onDone }: { invoiceId: number; number: string; balance: number; paid: number; refund?: boolean; onClose: () => void; onDone: () => void }) {
  const { t, money } = useI18n(); const toast = useToast()
  const [amount, setAmount] = useState(String(refund ? paid : Math.max(0, balance))); const [method, setMethod] = useState('cash'); const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({})
  const save = async () => {
    setBusy(true); setErrs({})
    try { await api(`/invoices/${invoiceId}/payments`, { body: { amount: Number(amount), method, kind: refund ? 'refund' : 'payment', reference: ref || null } }); toast(t('common.saved')); onDone() }
    catch (e) { setErrs(fieldErrors(e)); toast(errMsg(e), 'err') } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} size="sm" title={`${refund ? t('bill.refund') : t('bill.addPayment')} · ${number}`} footer={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" loading={busy} onClick={save}>{t('common.save')}</Button></>}>
      <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">{refund ? t('bill.paid') : t('bill.balance')}: <b className="num">{money(refund ? paid : balance)}</b></p>
      <div className="space-y-4">
        <Field label={t('common.amount')} error={errs.amount}><Input type="number" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} error={!!errs.amount} autoFocus /></Field>
        <Field label={t('common.method')}><Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m} value={m}>{t('method.' + m)}</option>)}</Select></Field>
        <Field label={t('bill.reference')} optional><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}
