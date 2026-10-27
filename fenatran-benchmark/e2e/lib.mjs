// Shared helpers for the Puppeteer quality checks: static server for dist/, Edge launcher,
// fixtures and small page utilities.
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const DIST = join(ROOT, 'dist')
export const SHOTS = join(ROOT, 'e2e', 'screenshots')
export const EDGE =
  process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

export const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800, mobile: true },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '430x932', width: 430, height: 932, mobile: true },
  { name: '768x1024', width: 768, height: 1024, mobile: true },
  { name: '1366x768', width: 1366, height: 768, mobile: false },
  { name: '1920x1080', width: 1920, height: 1080, mobile: false },
]

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

// Serves dist/ on 127.0.0.1 (a secure context, so the service worker registers).
export function startServer() {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ missing: run npm run build')
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    let file = normalize(join(DIST, path))
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end()
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      res.writeHead(404).end('Not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    createReadStream(file).pipe(res)
  })
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      ok({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}

export function launch() {
  if (!existsSync(EDGE)) throw new Error(`Microsoft Edge not found at ${EDGE} (set EDGE_PATH)`)
  return puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-features=msEdgeSidebarV2'],
  })
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
  return dir
}

// Web Share is removed so the app takes the download fallback, which Puppeteer can capture.
export async function newPage(browser, { width = 390, height = 844, mobile = true } = {}) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile })
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true })
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true })
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return { page, context, errors }
}

export const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))

export async function clickText(page, text, selector = 'button, a, label') {
  const handle = await page.waitForFunction(
    (sel, wanted) =>
      [...document.querySelectorAll(sel)].find(
        (el) => el.textContent?.trim() === wanted && !el.disabled && el.offsetParent !== null,
      ),
    { timeout: 10_000 },
    selector,
    text,
  )
  await handle.asElement().click()
}

export async function waitText(page, text, timeout = 10_000) {
  await page.waitForFunction(
    (t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()),
    { timeout },
    text,
  )
}

export async function fieldByLabel(page, label) {
  const handle = await page.waitForFunction(
    (wanted) => {
      const node = [...document.querySelectorAll('label')].find(
        (l) => l.textContent?.trim().startsWith(wanted) && l.offsetParent !== null,
      )
      if (!node) return null
      return node.control ?? node.querySelector('input, select, textarea')
    },
    { timeout: 10_000 },
    label,
  )
  return handle.asElement()
}

export async function typeInto(page, label, text) {
  const field = await fieldByLabel(page, label)
  await field.click({ count: 3 })
  await field.type(text)
}

export async function selectByLabel(page, label, value) {
  const field = await fieldByLabel(page, label)
  await field.select(value)
}

// Creates decodable JPEG fixtures with the browser canvas (no binary files in the repo).
export async function makePhotos(page, dir, count) {
  const { writeFileSync } = await import('node:fs')
  const files = []
  for (let i = 0; i < count; i += 1) {
    const data = await page.evaluate((n) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 800
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = ['#202A44', '#678C96', '#396976'][n % 3]
      ctx.fillRect(0, 0, 1200, 800)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '120px sans-serif'
      ctx.fillText(`Photo ${n + 1}`, 300, 450)
      return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]
    }, i)
    const file = join(dir, `fixture-${i + 1}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    files.push(file)
  }
  return files
}

export async function onboard(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0' })
  await waitText(page, 'Name (optional)')
  const email = await page.waitForSelector('input[type="email"], input[name="email"]')
  await email.type('joao.silva@example.com')
  await typeInto(page, 'Name (optional)', 'João Silva Test')
  await clickText(page, 'Start')
  await waitText(page, 'New evaluation')
}

export function report(results) {
  let failed = 0
  for (const { name, problems } of results) {
    if (problems.length === 0) console.log(`PASS ${name}`)
    else {
      failed += 1
      console.log(`FAIL ${name}`)
      for (const problem of problems) console.log(`  - ${problem}`)
    }
  }
  return failed
}
