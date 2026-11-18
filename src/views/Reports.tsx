import { useMemo, useState } from 'react'
import { FileDown, FileSpreadsheet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from 'recharts'
import { qs, useApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { addDaysISO, fmtMoney, fmtNum, todayISO } from '@/lib/format'
import { Button, Card, ErrorState, Input, Loading, PageHeader, Select, StatCard, Tabs, errMsg, useToast } from '@/components/ui'

const PIE = ['#0e1a2b', '#b8924f', '#3a4f69', '#cfae72', '#8493a6', '#9a7437', '#22364f']
type Tab = 'revenue' | 'occupancy' | 'bookings' | 'guests' | 'financial'
type Sheet = { title: string; summary: [string, string][]; head: string[]; rows: (string | number)[][] }

export default function Reports() {
  const { t, lang } = useI18n(); const { settings } = useAuth(); const toast = useToast(); const cur = settings.currency ?? 'EGP'
  const [tab, setTab] = useState<Tab>('revenue'); const [from, setFrom] = useState(addDaysISO(todayISO(), -29)); const [to, setTo] = useState(todayISO()); const [group, setGroup] = useState('day')
  const { data: d, error, loading, reload } = useApi<any>(`/reports/${tab}` + qs({ from, to, group }))
  const m = (n: number) => fmtMoney(n, cur), tick = (x: string) => x.slice(group === 'month' ? 2 : 5)
  const sheet: Sheet | null = useMemo(() => {
    if (!d) return null
    if (tab === 'revenue') return { title: t('rep.revenue'), summary: [[t('rep.gross'), m(d.totals.gross)], [t('rep.refunds'), m(d.totals.refunds)], [t('rep.net'), m(d.totals.net)]], head: [t('common.date'), t('rep.revenue')], rows: d.series.map((r: any) => [r.date, Math.round(r.revenue)]) }
    if (tab === 'occupancy') return { title: t('rep.occupancy'), summary: [[t('rep.avgOcc'), fmtNum(d.series.reduce((a: number, r: any) => a + r.occupancy, 0) / Math.max(1, d.series.length)) + '%'], [t('rep.rooms'), String(d.rooms)]], head: [t('common.date'), t('rep.occupancy') + ' %'], rows: d.series.map((r: any) => [r.date, Math.round(r.occupancy)]) }
    if (tab === 'bookings') return { title: t('rep.bookings'), summary: [[t('rep.bookings'), fmtNum(d.totals.bookings)], [t('rep.cancelRate'), fmtNum(d.totals.cancellation_rate) + '%'], [t('rep.avgStay'), fmtNum(d.totals.avg_stay, 1)], [t('rep.bookedValue'), m(d.totals.booked_value)]], head: [t('common.date'), t('rep.bookings'), t('rep.cancelled')], rows: d.series.map((r: any) => [r.date, r.bookings, r.cancelled]) }
    if (tab === 'guests') return { title: t('rep.guests'), summary: [[t('rep.totalGuests'), fmtNum(d.totals.guests)], ['VIP', fmtNum(d.totals.vip)], [t('rep.newGuests'), fmtNum(d.totals.new_guests)], [t('rep.adults'), fmtNum(d.totals.adults)]], head: [t('common.name'), t('guest.nationality'), t('guest.stays'), t('guest.spent')], rows: d.top.map((g: any) => [g.name, g.nationality ?? '', g.stays, Math.round(g.spent)]) }
    return { title: t('rep.financial'), summary: [[t('rep.invoiced'), m(d.totals.invoiced)], [t('rep.collected'), m(d.totals.net_collected)], [t('rep.tax'), m(d.totals.tax)], [t('bill.totalOutstanding'), m(d.totals.outstanding_total)]], head: [t('bill.number'), t('res.guest'), t('common.total'), t('bill.paid'), t('bill.balance')], rows: d.outstanding.map((o: any) => [o.number, o.guest_name, Math.round(o.total), Math.round(o.paid), Math.round(o.balance)]) }
  }, [d, tab, lang])
  const file = `hotelna-${tab}-${from}_${to}`
  const toPdf = async () => {
    if (!sheet) return
    try {
      const [{ jsPDF }, at] = await Promise.all([import('jspdf'), import('jspdf-autotable')]); const doc = new jsPDF()
      doc.setFontSize(18); doc.text(`${settings.hotel_name ?? 'Hotelna'} - ${sheet.title}`, 14, 18); doc.setFontSize(10); doc.text(`${from} → ${to}`, 14, 25)
      sheet.summary.forEach(([a, b], i) => doc.text(`${a}: ${b}`, 14, 33 + i * 6))
      ;(at.default ?? (at as any).autoTable)(doc, { startY: 36 + sheet.summary.length * 6, head: [sheet.head], body: sheet.rows.map((r) => r.map((c) => typeof c === 'number' ? fmtNum(c) : c)), headStyles: { fillColor: [14, 26, 43] } })
      doc.save(file + '.pdf')
    } catch (e) { toast(errMsg(e), 'err') }
  }
  const toXlsx = async () => {
    if (!sheet) return
    try {
      const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheet.title.slice(0, 30))
      ws.addRow([sheet.title]); ws.addRow([`${from} → ${to}`]); sheet.summary.forEach((r) => ws.addRow(r)); ws.addRow([]); const h = ws.addRow(sheet.head); h.font = { bold: true }; sheet.rows.forEach((r) => ws.addRow(r)); ws.columns.forEach((c) => (c.width = 22))
      const buf = await wb.xlsx.writeBuffer(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = file + '.xlsx'; a.click(); URL.revokeObjectURL(a.href)
    } catch (e) { toast(errMsg(e), 'err') }
  }
  const tip = { contentStyle: { borderRadius: 12, border: '1px solid #eef1f5', fontSize: 12 } }
  const Pie1 = ({ data }: { data: { name: string; count: number }[] }) => <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={data} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
  return (
    <div>
      <PageHeader title={t('rep.title')} subtitle={t('rep.subtitle')} actions={<><Button onClick={toXlsx} disabled={!sheet}><FileSpreadsheet className="size-4" />Excel</Button><Button variant="primary" onClick={toPdf} disabled={!sheet}><FileDown className="size-4" />PDF</Button></>} />
      <Tabs tabs={(['revenue', 'occupancy', 'bookings', 'guests', 'financial'] as Tab[]).map((x) => ({ id: x, label: t('rep.' + x) }))} value={tab} onChange={setTab} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-44" /><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="w-44" />
        {['revenue', 'occupancy', 'bookings'].includes(tab) && <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-36"><option value="day">{t('rep.daily')}</option><option value="week">{t('rep.weekly')}</option><option value="month">{t('rep.monthly')}</option></Select>}
      </div>
      {loading && !d ? <Loading /> : error || !d || !sheet ? <ErrorState error={error ?? new Error('')} retry={reload} /> : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{sheet.summary.map(([a, b]) => <StatCard key={a} label={a} value={b} />)}</div>
          <Card className="p-5"><ResponsiveContainer width="100%" height={300}>
            {tab === 'revenue' ? <AreaChart data={d.series}><defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8924f" stopOpacity={0.35} /><stop offset="1" stopColor="#b8924f" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef1f5" /><XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} /><YAxis tickFormatter={(v) => fmtNum(v / 1000) + 'k'} tick={{ fontSize: 11 }} /><Tooltip {...tip} formatter={(v: any) => m(v)} /><Area dataKey="revenue" stroke="#b8924f" strokeWidth={2} fill="url(#rv)" /></AreaChart>
              : tab === 'occupancy' ? <LineChart data={d.series}><CartesianGrid vertical={false} stroke="#eef1f5" /><XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} /><Tooltip {...tip} /><Line dataKey="occupancy" stroke="#0e1a2b" strokeWidth={2} dot={false} /></LineChart>
              : tab === 'bookings' ? <BarChart data={d.series}><CartesianGrid vertical={false} stroke="#eef1f5" /><XAxis dataKey="date" tickFormatter={tick} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip {...tip} /><Bar dataKey="bookings" fill="#0e1a2b" radius={[4, 4, 0, 0]} /><Bar dataKey="cancelled" fill="#b8924f" radius={[4, 4, 0, 0]} /></BarChart>
              : tab === 'guests' ? <BarChart data={d.nationalities} layout="vertical"><CartesianGrid horizontal={false} stroke="#eef1f5" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} /><Tooltip {...tip} /><Bar dataKey="count" fill="#b8924f" radius={[0, 4, 4, 0]} /></BarChart>
              : <BarChart data={d.byType}><CartesianGrid vertical={false} stroke="#eef1f5" /><XAxis dataKey="type" tickFormatter={(x) => t('bill.itemType.' + x)} tick={{ fontSize: 11 }} /><YAxis tickFormatter={(v) => fmtNum(v / 1000) + 'k'} tick={{ fontSize: 11 }} /><Tooltip {...tip} formatter={(v: any) => m(v)} /><Bar dataKey="amount" fill="#0e1a2b" radius={[4, 4, 0, 0]} /></BarChart>}
          </ResponsiveContainer></Card>
          {tab === 'bookings' && <div className="grid gap-5 md:grid-cols-3">{[['bySource', t('dash.bookingSource')], ['byStatus', t('dash.bookingStatus')], ['byCategory', t('rep.byCategory')]].map(([k, l]) => <Card key={k} className="p-5"><p className="mb-2 text-sm font-semibold">{l}</p><Pie1 data={d[k]} /></Card>)}</div>}
          <Card><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-ink-100 text-xs text-ink-500">{sheet.head.map((h) => <th key={h} className="px-4 py-3 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>{sheet.rows.slice(0, 50).map((r, i) => <tr key={i} className="border-b border-ink-50 last:border-0">{r.map((c, j) => <td key={j} className="num px-4 py-2.5 text-start">{typeof c === 'number' ? fmtNum(c) : c}</td>)}</tr>)}</tbody></table></div></Card>
        </div>
      )}
    </div>
  )
}
