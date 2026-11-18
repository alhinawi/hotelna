// node scripts/shots.mjs <baseUrl> <lang> route:name ...   (dev tool, requires google-chrome + puppeteer-core)
import puppeteer from 'puppeteer-core'
const [base, lang, ...routes] = process.argv.slice(2)
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-gpu'], headless: 'new' })
const p = await b.newPage(); await p.setViewport({ width: +(process.env.VW||1440), height: +(process.env.VH||900), deviceScaleFactor: 1 })
p.on('pageerror', (e) => console.log('PAGEERROR', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()))
await p.evaluateOnNewDocument((l) => localStorage.setItem('hotelna_lang', l), lang)
await p.goto(base + '/', { waitUntil: 'networkidle0' })
if (routes[0] !== 'login:login') {
  await p.type('input[type=email]', 'admin@hotelna.example'); await p.type('input[type=password]', 'Admin@123'); await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), p.keyboard.press('Enter')])
  await new Promise((r) => setTimeout(r, 1500))
}
for (const r of routes) {
  const [route, name] = r.split(':')
  if (route !== 'login') { await p.goto(base + route, { waitUntil: 'networkidle0' }); await new Promise((r) => setTimeout(r, 1200)) }
  if (process.env.CLICK) for (const sel of process.env.CLICK.split('|')) { await p.evaluate((x) => { const [tag, txt] = x.split('~'); const el = [...document.querySelectorAll(tag)].find((e) => e.textContent.trim().includes(txt)); el && el.click() }, sel); await new Promise((r) => setTimeout(r, 900)) }
  await p.screenshot({ path: `shots/${name}-${lang}.png`, fullPage: name.endsWith('-full') })
  console.log('shot', name)
}
await b.close()
