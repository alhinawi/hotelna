import { useState } from 'react'
import { Languages } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { Button, Field, Input, errMsg } from '@/components/ui'
import { Logo } from '@/components/Layout'

const DEMO = [
  ['admin@hotelna.example', 'Admin@123', 'admin'], ['manager@hotelna.example', 'Manager@123', 'manager'], ['frontdesk@hotelna.example', 'Front@12345', 'front_desk'],
  ['housekeeping@hotelna.example', 'House@12345', 'housekeeping'], ['accountant@hotelna.example', 'Account@123', 'accountant'],
]
export default function Login() {
  const { login } = useAuth(); const { t, lang, setLang } = useI18n()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await login(email, password) } catch (x) { setErr(errMsg(x)) } finally { setBusy(false) }
  }
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/img/pool.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-900/50 to-ink-900/30" />
        <div className="absolute inset-x-0 bottom-0 p-12"><Logo size="lg" /><p className="mt-4 max-w-sm font-display text-xl text-ink-100">{t('app.tagline')}</p></div>
      </div>
      <div className="flex flex-col justify-center px-6 py-10 sm:px-16">
        <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="absolute end-6 top-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-600 hover:bg-ink-100"><Languages className="size-4" />{lang === 'en' ? 'العربية' : 'English'}</button>
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo light={false} /></div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">{t('login.title')}</h1>
          <p className="mt-2 text-sm text-ink-500">{t('login.subtitle')}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label={t('login.email')}><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></Field>
            <Field label={t('login.password')}><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></Field>
            {err && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
            <Button type="submit" variant="primary" loading={busy} className="h-11 w-full">{t('login.submit')}</Button>
          </form>
          <div className="mt-10 rounded-xl border border-ink-100 bg-white p-4">
            <p className="text-xs font-semibold text-ink-700">{t('login.demo')}</p><p className="mb-2 text-xs text-ink-400">{t('login.demoHint')}</p>
            <div className="space-y-1">
              {DEMO.map(([e, p, r]) => (
                <button key={e} type="button" onClick={() => { setEmail(e); setPassword(p) }} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-start text-xs hover:bg-gold-100/50">
                  <span className="font-medium text-ink-700">{t('role.' + r)}</span><span className="text-ink-400" dir="ltr">{e}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
