import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, type Key } from './en'
import { ar } from './ar'
import { fmtDate, fmtMoney, fmtDateTime, type Lang } from './format'

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key | string, vars?: Record<string, string | number>) => string; dir: 'ltr' | 'rtl'; date: (d?: string | null) => string; dt: (d?: string | null) => string; money: (n: number) => string; currency: string; setCurrency: (c: string) => void }
const I18n = createContext<Ctx>(null as any)
export const useI18n = () => useContext(I18n)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('hotelna_lang') as Lang) || 'en')
  const [currency, setCurrency] = useState('EGP')
  const setLang = (l: Lang) => { localStorage.setItem('hotelna_lang', l); setLangState(l) }
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr' }, [lang])
  const t = useCallback((k: string, vars?: Record<string, string | number>) => {
    let s = (lang === 'ar' ? (ar as any)[k] : undefined) ?? (en as any)[k] ?? k
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, String(b))
    return s
  }, [lang])
  const value = useMemo<Ctx>(() => ({ lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr', date: (d) => fmtDate(d, lang), dt: (d) => fmtDateTime(d, lang), money: (n) => fmtMoney(n, currency, lang), currency, setCurrency }), [lang, t, currency])
  return <I18n.Provider value={value}>{children}</I18n.Provider>
}
