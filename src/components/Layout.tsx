import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, BedDouble, CalendarCheck, Languages, LayoutDashboard, LogOut, Menu, Receipt, Settings, Sparkles, UserCog, Users, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { api, bus } from '@/lib/api'
import type { Module } from '../../shared/perms'
import { cx, IconButton } from './ui'

export const Logo = ({ light = true, size = 'md' }: { light?: boolean; size?: 'md' | 'lg' }) => (
  <div className="flex items-center gap-2.5">
    <div className={cx('flex items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 font-display font-bold text-white shadow-lg shadow-gold-600/20', size === 'lg' ? 'size-12 text-2xl' : 'size-9 text-lg')}>H</div>
    <span className={cx('font-display font-semibold tracking-tight', size === 'lg' ? 'text-3xl' : 'text-xl', light ? 'text-white' : 'text-ink-900')}>Hotelna</span>
  </div>
)

const NAV: { to: string; key: string; icon: typeof Menu; module: Module }[] = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { to: '/reservations', key: 'nav.reservations', icon: CalendarCheck, module: 'reservations' },
  { to: '/rooms', key: 'nav.rooms', icon: BedDouble, module: 'rooms' },
  { to: '/guests', key: 'nav.guests', icon: Users, module: 'guests' },
  { to: '/housekeeping', key: 'nav.housekeeping', icon: Sparkles, module: 'housekeeping' },
  { to: '/billing', key: 'nav.billing', icon: Receipt, module: 'billing' },
  { to: '/staff', key: 'nav.staff', icon: UserCog, module: 'staff' },
  { to: '/reports', key: 'nav.reports', icon: BarChart3, module: 'reports' },
  { to: '/settings', key: 'nav.settings', icon: Settings, module: 'settings' },
]

export function Layout() {
  const { user, can, logout, settings } = useAuth()
  const { t, lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  // real-time-ish updates: poll the change marker and tell pages to reload when something changed
  const last = useRef<number | null>(null)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (document.hidden) return
      try { const r = await api<{ last: number }>('/changes'); if (!alive) return; if (last.current !== null && r.last !== last.current) bus.dispatchEvent(new Event('changed')); last.current = r.last } catch { /* ignore */ }
    }
    tick(); const id = setInterval(tick, 5000)
    const vis = () => !document.hidden && tick()
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [])

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Main">
      {NAV.filter((n) => can(n.module)).map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-white/10 text-white shadow-inner' : 'text-ink-300 hover:bg-white/5 hover:text-white')}>
          {({ isActive }) => (<><n.icon className={cx('size-[18px]', isActive ? 'text-gold-400' : 'text-ink-400 group-hover:text-gold-400')} />{t(n.key)}</>)}
        </NavLink>
      ))}
    </nav>
  )
  const initials = (user?.name ?? '?').split(' ').map((s) => s[0]).slice(0, 2).join('')
  return (
    <div className="flex min-h-full">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-ink-900 to-ink-950 lg:flex">
        <div className="px-5 pt-6"><Logo /></div>
        <p className="mt-1 truncate px-5 text-xs text-ink-400">{settings.hotel_name}</p>
        {nav}
        <UserBox initials={initials} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col bg-ink-900">
            <div className="flex items-center justify-between px-5 pt-5"><Logo /><IconButton className="text-white hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label={t('common.close')}><X className="size-5" /></IconButton></div>
            {nav}<UserBox initials={initials} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-100 bg-ivory/85 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2 lg:hidden"><IconButton onClick={() => setOpen(true)} aria-label="Menu"><Menu className="size-5" /></IconButton><Logo light={false} /></div>
          <div className="hidden items-center gap-2 text-xs text-ink-500 lg:flex"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>{t('common.live')}</div>
          <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-600 hover:bg-ink-100" aria-label="Language">
            <Languages className="size-4" />{lang === 'en' ? 'العربية' : 'English'}
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8 lg:py-8"><Outlet /></main>
      </div>
    </div>
  )
  function UserBox({ initials }: { initials: string }) {
    return (
      <div className="m-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-sm font-semibold text-gold-400">{initials}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{user?.name}</p><p className="truncate text-xs text-ink-400">{t('role.' + user?.role)}</p></div>
        <IconButton onClick={logout} className="text-ink-300 hover:bg-white/10 hover:text-white" aria-label={t('nav.signout')} title={t('nav.signout')}><LogOut className="size-4" /></IconButton>
      </div>
    )
  }
}
