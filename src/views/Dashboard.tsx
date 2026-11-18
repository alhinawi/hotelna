import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BedDouble, CalendarCheck, DoorClosed, DoorOpen, Hammer, Percent, Star, TrendingUp, Users, Wallet, Sparkles } from 'lucide-react'
import { useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { fmtAgo, fmtMoney0, fmtNum, fmtShort } from '@/lib/format'
import { Card, CardHeader, ErrorState, Loading, PageHeader, StatCard, StatusBadge, Badge } from '@/components/ui'

const GOLD = '#b8924f', INK = '#0e1a2b'
const PIE = ['#0e1a2b', '#b8924f', '#3a4f69', '#cfae72', '#8493a6', '#9a7437']

export default function Dashboard() {
  const { data: d, error, loading, reload } = useApi<any>('/dashboard')
  const { user, settings } = useAuth(); const { t, lang, date } = useI18n(); const nav = useNavigate()
  if (loading && !d) return <Loading />
  if (error || !d) return <ErrorState error={error ?? new Error('')} retry={reload} />
  const cur = settings.currency_symbol || 'EGP'
  const m0 = (n: number) => fmtMoney0(n, cur)
  const mc = (n: number) => (n >= 1e6 ? `${fmtNum(n / 1e6, 2)}M ${cur}` : fmtMoney0(n, cur))
  const tip = { contentStyle: { borderRadius: 10, border: '1px solid #eef1f5', fontSize: 12, direction: 'ltr' as const } }
  return (
    <div>
      <PageHeader title={t('dash.welcome', { name: user!.name.split(' ')[0] })} subtitle={t('dash.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('dash.occupancy')} value={`${d.occupancy_rate}%`} sub={`${d.rooms.occupied} / ${d.rooms.total} ${t('nav.rooms').toLowerCase()}`} icon={<Percent className="size-5" />} tone="gold" />
        <StatCard label={t('dash.revenueToday')} value={m0(d.revenue.today)} sub={`${t('dash.revenueMonth')}: ${m0(d.revenue.month)}`} icon={<TrendingUp className="size-5" />} tone="green" />
        <StatCard label={t('dash.checkinsToday')} value={`${d.checkins.done} / ${d.checkins.total}`} sub={t('dash.arrivalsSoon') + ': ' + d.upcoming_7d} icon={<DoorOpen className="size-5" />} tone="blue" />
        <StatCard label={t('dash.checkoutsToday')} value={`${d.checkouts.done} / ${d.checkouts.total}`} sub={`${d.rooms.dirty} ${t('dash.dirty')}`} icon={<DoorClosed className="size-5" />} tone="amber" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t('dash.totalRooms')} value={d.rooms.total} icon={<BedDouble className="size-5" />} />
        <StatCard label={t('dash.occupied')} value={d.rooms.occupied} icon={<Users className="size-5" />} tone="blue" sub={`${d.in_house} ${t('dash.inHouse').toLowerCase()}`} />
        <StatCard label={t('dash.vacant')} value={d.rooms.vacant} icon={<CalendarCheck className="size-5" />} tone="green" />
        <StatCard label={t('dash.maintenance')} value={d.rooms.maintenance} icon={<Hammer className="size-5" />} tone="amber" />
        <StatCard label={t('dash.outstanding')} value={mc(d.revenue.outstanding)} icon={<Wallet className="size-5" />} tone="red" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('dash.revenue14')} />
          <div className="h-72 p-4 ps-0" dir="ltr">
            <ResponsiveContainer>
              <AreaChart data={d.revenue14}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.35} /><stop offset="100%" stopColor={GOLD} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#eef1f5" />
                <XAxis dataKey="date" tickFormatter={(v) => fmtShort(v, lang)} tick={{ fontSize: 11, fill: '#8493a6' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? fmtNum(v / 1000) + 'k' : v)} tick={{ fontSize: 11, fill: '#8493a6' }} tickLine={false} axisLine={false} width={44} />
                <Tooltip {...tip} formatter={(v: any) => [m0(v), t('dash.revenueToday')]} labelFormatter={(v) => date(v as string)} />
                <Area type="monotone" dataKey="revenue" stroke={GOLD} strokeWidth={2.5} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title={t('dash.bookingSource')} />
          <div className="flex h-72 flex-col items-center justify-center p-4" dir="ltr">
            <ResponsiveContainer height={170}>
              <PieChart><Pie data={d.bookings.bySource} dataKey="n" nameKey="source" innerRadius={48} outerRadius={78} paddingAngle={2} strokeWidth={0}>{d.bookings.bySource.map((_: any, i: number) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip {...tip} formatter={(v: any, n: any) => [v, t('source.' + n)]} /></PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 grid w-full grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-600">
              {d.bookings.bySource.slice(0, 6).map((s: any, i: number) => <li key={s.source} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: PIE[i % PIE.length] }} /><span className="truncate">{t('source.' + s.source)}</span><span className="num ms-auto text-ink-400">{s.n}</span></li>)}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('dash.occTrend')} />
          <div className="h-56 p-4 ps-0" dir="ltr">
            <ResponsiveContainer>
              <LineChart data={d.occupancyTrend}>
                <CartesianGrid vertical={false} stroke="#eef1f5" />
                <XAxis dataKey="date" tickFormatter={(v) => fmtShort(v, lang)} tick={{ fontSize: 10, fill: '#8493a6' }} tickLine={false} axisLine={false} interval={2} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => v + '%'} tick={{ fontSize: 11, fill: '#8493a6' }} tickLine={false} axisLine={false} width={40} />
                <Tooltip {...tip} formatter={(v: any) => [v + '%', t('dash.occupancy')]} labelFormatter={(v) => date(v as string)} />
                <Line type="monotone" dataKey="occupancy" stroke={INK} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title={t('dash.bookingStatus')} />
          <div className="h-56 p-4 ps-0" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={d.bookings.byStatus.map((s: any) => ({ ...s, label: t('status.' + s.status) }))} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide /><YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#5b6d84' }} tickLine={false} axisLine={false} width={104} />
                <Tooltip {...tip} cursor={{ fill: '#f6f8fa' }} /><Bar dataKey="n" fill={GOLD} radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title={t('dash.arrivals')} action={<Badge tone="blue">{d.arrivals.length}</Badge>} />
          <GuestList items={d.arrivals} empty={t('dash.noArrivals')} />
          <div className="border-t border-ink-100" />
          <CardHeader title={t('dash.departures')} action={<Badge tone="amber">{d.departures.length}</Badge>} />
          <GuestList items={d.departures} empty={t('dash.noDepartures')} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title={t('dash.recent')} action={<Link to="/reservations" className="text-xs font-medium text-gold-600 hover:underline">{t('dash.viewAll')}</Link>} />
          <ul className="divide-y divide-ink-100">
            {d.recent.map((r: any) => (
              <li key={r.id} className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-gold-100/30" onClick={() => nav('/reservations?open=' + r.id)}>
                <div className="flex size-9 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-600">{r.room_number}</div>
                <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink-900">{r.guest_name}{r.guest_vip ? <Star className="size-3 fill-gold-500 text-gold-500" /> : null}</p><p className="tabular-nums text-xs text-ink-500">{date(r.check_in)} → {date(r.check_out)}</p></div>
                <div className="text-end"><StatusBadge status={r.status} /><p className="num mt-1 text-xs text-ink-500">{m0(r.total)}</p></div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t('dash.activity')} action={<Sparkles className="size-4 text-gold-500" />} />
          <ul className="max-h-[420px] divide-y divide-ink-100 overflow-y-auto">
            {d.activity.map((a: any) => (
              <li key={a.id} className="px-5 py-3"><p className="text-sm text-ink-800">{a.message}</p><p className="mt-0.5 text-xs text-ink-400">{a.user_name} · {fmtAgo(a.ts, lang)}</p></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
function GuestList({ items, empty }: { items: any[]; empty: string }) {
  const nav = useNavigate()
  if (!items.length) return <p className="px-5 py-5 text-sm text-ink-400">{empty}</p>
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((r) => (
        <li key={r.id} className="flex cursor-pointer items-center gap-3 px-5 py-2.5 hover:bg-gold-100/30" onClick={() => nav('/reservations?open=' + r.id)}>
          <span className="num flex size-8 items-center justify-center rounded-lg bg-ink-100 text-xs font-semibold text-ink-700">{r.room_number}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{r.guest_name}</span><StatusBadge status={r.status} />
        </li>
      ))}
    </ul>
  )
}
