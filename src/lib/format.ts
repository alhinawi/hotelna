export type Lang = 'en' | 'ar'
const loc = (l: Lang) => (l === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB')
export const fmtNum = (n: number, d = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n ?? 0)
export const fmtMoney = (n: number, cur = 'EGP', _l?: Lang) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n ?? 0)} ${cur}`
export const fmtMoney0 = (n: number, cur = 'EGP') => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n ?? 0)} ${cur}`
export const fmtDate = (d?: string | null, l: Lang = 'en') => {
  if (!d) return ''
  const dt = new Date(d.slice(0, 10) + 'T00:00:00Z')
  if (l !== 'ar') return new Intl.DateTimeFormat(loc(l), { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(dt)
  const mo = new Intl.DateTimeFormat(loc(l), { month: 'long', timeZone: 'UTC' }).format(dt)
  return `${String(dt.getUTCDate()).padStart(2, '0')} ${mo} ${dt.getUTCFullYear()}`
}
export const fmtShort = (d: string, l: Lang = 'en') => new Intl.DateTimeFormat(loc(l), { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(d.slice(0, 10) + 'T00:00:00Z'))
export const fmtWeekday = (d: string, l: Lang = 'en') => new Intl.DateTimeFormat(loc(l), { weekday: 'short', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'))
export const fmtDateTime = (d?: string | null, l: Lang = 'en') => (d ? new Intl.DateTimeFormat(loc(l), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Cairo' }).format(new Date(d.replace(' ', 'T') + 'Z')) : '')
export const fmtAgo = (d: string, l: Lang = 'en') => {
  const s = Math.max(0, (Date.now() - new Date(d.replace(' ', 'T') + 'Z').getTime()) / 1000)
  const r = new Intl.RelativeTimeFormat(loc(l), { numeric: 'auto' })
  if (s < 3600) return r.format(-Math.max(1, Math.round(s / 60)), 'minute')
  if (s < 86400) return r.format(-Math.round(s / 3600), 'hour')
  return r.format(-Math.round(s / 86400), 'day')
}
export const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
export const addDaysISO = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
export const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
