import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Inbox, Loader2, Search, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { ApiError } from '@/lib/api'

export const cx = clsx

// ---------- buttons
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'; size?: 'sm' | 'md'; loading?: boolean }
export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'bg-ink-900 text-white hover:bg-ink-800 shadow-sm',
    gold: 'bg-gold-500 text-white hover:bg-gold-600 shadow-sm',
    secondary: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50',
    ghost: 'text-ink-600 hover:bg-ink-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  }[variant]
  return (
    <button {...p} disabled={disabled || loading} className={cx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap', size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm', v, className)}>
      {loading && <Loader2 className="size-4 animate-spin" />}{children}
    </button>
  )
}
export const IconButton = ({ className, ...p }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className={cx('inline-flex size-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-gold-500', className)} />
)

// ---------- fields
export function Field({ label, error, hint, optional, children, className }: { label?: string; error?: string; hint?: string; optional?: boolean; children: ReactNode; className?: string }) {
  const { t } = useI18n()
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-600">{label}{optional && <span className="ms-1 text-ink-400">({t('common.optional')})</span>}</span>}
      {children}
      {error ? <span className="mt-1 flex items-center gap-1 text-xs text-rose-600"><AlertCircle className="size-3" />{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>
  )
}
const inputCls = (err?: boolean, cn?: string) => cx('h-10 rounded-lg border bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gold-400/40', err ? 'border-rose-400' : 'border-ink-200 focus:border-gold-500', /(^| )(sm:|md:)?w-/.test(cn ?? '') ? '' : 'w-full')
export const Input = ({ error, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) => <input {...p} className={cx(inputCls(error, className), className)} />
export const Select = ({ error, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) => <select {...p} className={cx(inputCls(error, className), 'pe-8', className)}>{children}</select>
export const Textarea = ({ error, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) => <textarea {...p} className={cx(inputCls(error, className), 'h-auto min-h-20 py-2', className)} />

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { t } = useI18n()
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  useEffect(() => { const id = setTimeout(() => v !== value && onChange(v), 300); return () => clearTimeout(id) }, [v])
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder ?? t('common.search')} className="ps-9 sm:w-64" aria-label={t('common.search')} />
    </div>
  )
}

// ---------- surfaces
export const Card = ({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) => <div {...p} className={cx('rounded-xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(14,26,43,.04)]', className)}>{children}</div>
export const CardHeader = ({ title, action, sub }: { title: ReactNode; action?: ReactNode; sub?: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
    <div><h3 className="text-sm font-semibold text-ink-900">{title}</h3>{sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}</div>{action}
  </div>
)
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const tones: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', red: 'bg-rose-50 text-rose-700 ring-rose-600/15', amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15', gray: 'bg-ink-100 text-ink-600 ring-ink-300/40', gold: 'bg-gold-100 text-gold-600 ring-gold-400/30', violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
}
export const Badge = ({ tone = 'gray', children, className }: { tone?: keyof typeof tones | string; children: ReactNode; className?: string }) => (
  <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone] ?? tones.gray, className)}>{children}</span>
)
const STATUS_TONE: Record<string, string> = {
  available: 'green', occupied: 'blue', maintenance: 'amber', clean: 'green', dirty: 'red', cleaning: 'amber', inspected: 'violet',
  confirmed: 'blue', checked_in: 'green', checked_out: 'gray', cancelled: 'red', no_show: 'red', pending: 'amber', in_progress: 'blue', completed: 'green',
  open: 'amber', resolved: 'green', void: 'gray', paid: 'green', partial: 'amber', unpaid: 'red', active: 'green', on_leave: 'amber', terminated: 'gray',
  present: 'green', absent: 'red', late: 'amber', leave: 'amber', low: 'gray', normal: 'blue', high: 'amber', urgent: 'red',
}
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  return <Badge tone={STATUS_TONE[status] ?? 'gray'}>{t('status.' + status) === 'status.' + status ? t('priority.' + status) : t('status.' + status)}</Badge>
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cx('size-5 animate-spin text-gold-500', className)} />
export function Loading() { const { t } = useI18n(); return <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-500" role="status"><Spinner />{t('common.loading')}</div> }
export function EmptyState({ title, hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-ink-50 text-ink-400"><Inbox className="size-6" /></div>
      <p className="text-sm font-medium text-ink-700">{title ?? t('common.noResults')}</p>
      <p className="max-w-xs text-xs text-ink-400">{hint ?? t('common.noResultsHint')}</p>{action}
    </div>
  )
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center"><AlertCircle className="size-8 text-rose-500" /><p className="text-sm text-ink-700">{error.message || t('common.error')}</p>{retry && <Button onClick={retry}>{t('common.refresh')}</Button>}</div>
  )
}

// ---------- modal
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const { t } = useI18n(); const id = useId()
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', h); document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={id}>
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', w)}>
        <div className="flex items-center justify-between gap-4 border-b border-ink-100 px-6 py-4">
          <h2 id={id} className="font-display text-lg font-semibold text-ink-900">{title}</h2>
          <IconButton onClick={onClose} aria-label={t('common.close')}><X className="size-5" /></IconButton>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/60 px-6 py-3.5 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  )
}
export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel, danger = true }: { open: boolean; onClose: () => void; onConfirm: () => Promise<void> | void; title: string; message?: string; confirmLabel?: string; danger?: boolean }) {
  const { t } = useI18n(); const [busy, setBusy] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<>
      <Button onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>{confirmLabel ?? t('common.yesDelete')}</Button>
    </>}><p className="text-sm text-ink-600">{message ?? t('common.confirmDelete')}</p></Modal>
  )
}

// ---------- toast
type Toast = { id: number; kind: 'ok' | 'err'; text: string }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]); const n = useRef(0)
  const push = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = ++n.current; setItems((x) => [...x, { id, kind, text }]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className="pointer-events-auto flex max-w-md items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm text-white shadow-xl">
            {i.kind === 'ok' ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" /> : <AlertCircle className="size-4 shrink-0 text-rose-400" />}{i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : (e as Error)?.message || 'Error')
export const fieldErrors = (e: unknown): Record<string, string> => (e instanceof ApiError && e.details ? e.details : {})

// ---------- table
export type Col<T> = { key: string; header: ReactNode; sort?: string; render?: (r: T) => ReactNode; className?: string; hideOnMobile?: boolean }
export function DataTable<T extends { id: number | string }>({ cols, rows, sort, dir, onSort, onRow, empty }: { cols: Col<T>[]; rows: T[]; sort?: string; dir?: 'asc' | 'desc'; onSort?: (s: string) => void; onRow?: (r: T) => void; empty?: ReactNode }) {
  if (!rows.length) return <>{empty ?? <EmptyState />}</>
  const [first, ...rest] = cols
  return (
    <>
    <ul className="divide-y divide-ink-100 sm:hidden">
      {rows.map((r) => (
        <li key={r.id} onClick={onRow ? () => onRow(r) : undefined} className={cx('space-y-1.5 px-4 py-3 text-sm', onRow && 'cursor-pointer active:bg-gold-100/30')}>
          <div className="font-medium text-ink-900">{first.render ? first.render(r) : (r as any)[first.key]}</div>
          {rest.map((c) => (
            <div key={c.key} className={cx('flex items-center justify-between gap-3', !c.header && 'justify-end pt-1')}>
              {c.header ? <span className="text-xs text-ink-500">{c.header}</span> : null}
              <span className="min-w-0 text-ink-700">{c.render ? c.render(r) : (r as any)[c.key]}</span>
            </div>
          ))}
        </li>
      ))}
    </ul>
    <div className="overflow-x-auto max-sm:hidden">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-start text-xs uppercase tracking-wide text-ink-500">
            {cols.map((c) => (
              <th key={c.key} className={cx('px-4 py-3 text-start font-medium', c.className, c.hideOnMobile && 'max-sm:hidden')} aria-sort={c.sort && sort === c.sort ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sort && onSort ? (
                  <button className="inline-flex items-center gap-1 uppercase hover:text-ink-900" onClick={() => onSort(c.sort!)}>
                    {c.header}{sort === c.sort ? (dir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={r.id} onClick={onRow ? () => onRow(r) : undefined} className={cx('transition-colors', onRow && 'cursor-pointer hover:bg-gold-100/30')}>
              {cols.map((c) => <td key={c.key} className={cx('px-4 py-3 text-ink-700', c.className, c.hideOnMobile && 'max-sm:hidden')}>{c.render ? c.render(r) : (r as any)[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t, dir } = useI18n(); const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const Prev = dir === 'rtl' ? ChevronRight : ChevronLeft, Next = dir === 'rtl' ? ChevronLeft : ChevronRight
  return (
    <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
      <span className="num">{(page - 1) * pageSize + 1}-{Math.min(total, page * pageSize)} {t('common.of')} {total}</span>
      <div className="flex items-center gap-1">
        <IconButton disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous"><Prev className="size-4" /></IconButton>
        <span className="num px-2">{page} / {pages}</span>
        <IconButton disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next"><Next className="size-4" /></IconButton>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-100" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.id} role="tab" aria-selected={value === tb.id} onClick={() => onChange(tb.id)} className={cx('-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors', value === tb.id ? 'border-gold-500 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-800')}>
          {tb.label}{tb.count !== undefined && <span className="num ms-2 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px]">{tb.count}</span>}
        </button>
      ))}
    </div>
  )
}
export function StatCard({ label, value, sub, icon, tone = 'ink' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: 'ink' | 'gold' | 'green' | 'blue' | 'amber' | 'red' }) {
  const t = { ink: 'bg-ink-100 text-ink-700', gold: 'bg-gold-100 text-gold-600', green: 'bg-emerald-50 text-emerald-600', blue: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-rose-50 text-rose-600' }[tone]
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-medium text-ink-500">{label}</p><p className="num mt-2 truncate text-2xl font-semibold tracking-tight text-ink-900">{value}</p>{sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}</div>
        {icon && <div className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl', t)}>{icon}</div>}
      </div>
    </Card>
  )
}
export const Select2 = Select
