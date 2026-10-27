// Full user flow: onboarding, truck with photos, component, finalize, export (ZIP contents).
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import {
  clickText,
  ensureDir,
  makePhotos,
  onboard,
  selectByLabel,
  sleep,
  SHOTS,
  typeInto,
  waitText,
} from './lib.mjs'

async function waitForFiles(dir, predicate, timeout = 20_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const names = readdirSync(dir).filter((n) => !n.endsWith('.crdownload') && !n.endsWith('.tmp'))
    if (predicate(names)) return names
    await sleep(250)
  }
  throw new Error(`Timed out waiting for downloads in ${dir}: ${readdirSync(dir).join(', ')}`)
}

async function upload(page, sectionLabel, inputIndex, files) {
  const inputs = await page.$$(`section[aria-label="${sectionLabel}"] input[type="file"]`)
  assert.ok(inputs[inputIndex], `file input ${inputIndex} in "${sectionLabel}"`)
  const before = await page.$$eval(
    `section[aria-label="${sectionLabel}"] .media-tile`,
    (t) => t.length,
  )
  await inputs[inputIndex].uploadFile(...files)
  await page.waitForFunction(
    (label, count) =>
      document.querySelectorAll(`section[aria-label="${label}"] .media-tile`).length >= count,
    { timeout: 20_000 },
    sectionLabel,
    before + files.length,
  )
}

async function caption(page, sectionLabel, index, text) {
  const tiles = await page.$$(`section[aria-label="${sectionLabel}"] .media-tile`)
  await tiles[index].click()
  await page.waitForSelector('[role="dialog"] textarea')
  await sleep(600)
  await page.type('[role="dialog"] textarea', text)
  await clickText(page, 'Done')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
}

async function waitSaved(page) {
  await waitText(page, 'All changes saved', 15_000)
}

export async function runFlow({ browser, url, tmp }) {
  const problems = []
  const downloads = ensureDir(join(tmp, 'downloads'))
  rmSync(downloads, { recursive: true, force: true })
  ensureDir(downloads)
  const context = await browser.createBrowserContext({
    downloadBehavior: { policy: 'allow', downloadPath: downloads },
  })
  const page = await context.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true })
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true })
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  try {
    const photos = await makePhotos(page, ensureDir(join(tmp, 'fixtures')), 4)
    await onboard(page, url)

    // Truck evaluation
    await clickText(page, 'New evaluation')
    await waitText(page, 'What are you evaluating?')
    await clickText(
      page,
      'TruckBrand, model, brochure and feature review with scores 0-5.',
      'button',
    )
    await page.waitForSelector('.feature__toggle')
    await selectByLabel(page, 'Brand', 'Scania')
    await typeInto(page, 'Model', 'R 450 6x2')
    await upload(page, 'Brochure photos', 1, [photos[0], photos[1]])
    await caption(page, 'Brochure photos', 0, 'Brochure front page')
    // The first feature card is open by default.
    await page.waitForSelector('.feature__toggle[aria-expanded="true"]')
    await page.waitForSelector('.feature__body .rating__option')
    const options = await page.$$('.feature__body .rating__option')
    await options[4].click()
    await typeInto(page, 'Comment', 'Solid frame, clean tank brackets')
    await upload(page, 'Photos, videos and voice notes', 1, [photos[2]])
    await caption(page, 'Photos, videos and voice notes', 0, 'Battery box detail')
    await waitSaved(page)
    await page.screenshot({ path: join(SHOTS, 'flow-truck.png'), fullPage: true })
    await clickText(page, 'Finalize')
    await waitText(page, 'What will be exported')
    await waitText(page, '3 photos')
    await clickText(page, 'Confirm and finalize')
    await waitText(page, 'Finalized (1)')

    // Component evaluation
    await clickText(page, 'New evaluation')
    await clickText(
      page,
      'ComponentComponent name, manufacturer, images and observations.',
      'button',
    )
    await waitText(page, 'Comments and observations')
    await typeInto(page, 'Component', 'Battery')
    await typeInto(page, 'Manufacturer', 'Knorr-Bremse')
    await upload(page, 'Images, videos and voice notes', 1, [photos[3]])
    await typeInto(page, 'Comments and observations', 'Compact housing, easy access')
    await waitSaved(page)
    await clickText(page, 'Finalize')
    await waitText(page, 'What will be exported')
    await clickText(page, 'Finalize and export')

    // Export
    await waitText(page, 'Export to WhatsApp')
    await clickText(page, 'Create export')
    await waitText(page, 'Send to the WhatsApp group', 60_000)
    await page.screenshot({ path: join(SHOTS, 'flow-share.png'), fullPage: true })
    const zipButton = await page.waitForSelector('button[aria-label^="Download FENATRAN2026_"]')
    await zipButton.click()
    const names = await waitForFiles(downloads, (n) => n.some((x) => x.endsWith('.zip')))
    const zipName = names.find((n) => n.endsWith('.zip'))
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    assert.match(zipName, new RegExp(`^FENATRAN2026_Joao_Silva_Test_${today}\\.zip$`))

    const entries = unzipSync(new Uint8Array(readFileSync(join(downloads, zipName))))
    const paths = Object.keys(entries)
    for (const required of [
      'data.json',
      'gallery.json',
      'summary.md',
      'summary.xlsx',
      'README.txt',
    ]) {
      assert.ok(paths.includes(required), `${required} in ZIP`)
    }
    const data = JSON.parse(strFromU8(entries['data.json']))
    assert.equal(data.schema, 'fenatran-benchmark')
    assert.equal(data.part, 1)
    assert.equal(data.totalParts, 1)
    assert.equal(data.schemaVersion, 2)
    assert.equal(data.photoQuality, 'original')
    assert.equal(data.evaluator.name, 'João Silva Test')
    assert.deepEqual(data.evaluator, { name: 'João Silva Test', email: 'joao.silva@example.com' })
    assert.equal(data.evaluations.length, 2)
    const [truck, component] = data.evaluations
    assert.equal(truck.kind, 'truck')
    assert.equal(truck.status, 'finalized')
    assert.equal(truck.truck.brand, 'Scania')
    assert.equal(truck.truck.model, 'R 450 6x2')
    const scored = Object.values(truck.truck.features).filter((f) => f.score !== null)
    assert.equal(scored.length, 1)
    assert.equal(scored[0].score, 4)
    assert.equal(scored[0].comment, 'Solid frame, clean tank brackets')
    assert.equal(truck.media.length, 3)
    assert.ok(truck.media.some((m) => m.caption === 'Brochure front page' && m.role === 'brochure'))
    assert.ok(truck.media.some((m) => m.caption === 'Battery box detail' && m.role === 'feature'))
    assert.equal(component.kind, 'component')
    assert.equal(component.status, 'finalized')
    assert.equal(component.component.name, 'Battery')
    assert.equal(component.component.manufacturer, 'Knorr-Bremse')
    assert.equal(component.media.length, 1)
    for (const media of [...truck.media, ...component.media]) {
      assert.ok(media.file && paths.includes(media.file), `media file ${media.file} in ZIP`)
      const bytes = entries[media.file]
      assert.ok(bytes[0] === 0xff && bytes[1] === 0xd8, `${media.file} is a JPEG`)
    }
    assert.ok(
      paths.some((p) => /brochure.*front/i.test(p)),
      `caption slug in file name: ${paths.join(', ')}`,
    )
    const md = strFromU8(entries['summary.md'])
    assert.ok(md.includes('Scania') && md.includes('Battery'), 'summary.md lists evaluations')
    assert.equal(strFromU8(entries['summary.xlsx'].slice(0, 2)), 'PK')
    const gallery = JSON.parse(strFromU8(entries['gallery.json']))
    assert.equal(gallery.evaluatorEmail, 'joao.silva@example.com')
    assert.deepEqual(gallery.items.map((i) => i.caption).sort(), [
      'Battery box detail',
      'Brochure front page',
    ])
    for (const item of gallery.items) assert.ok(paths.includes(item.file), `gallery ${item.file}`)
    assert.ok(!(await page.evaluate(() => /Download \d+ photos/.test(document.body.innerText))))

    // Wipe keeps the profile
    await clickText(page, 'I sent everything')
    await clickText(page, 'Delete evaluations')
    await waitText(page, 'No evaluations yet')
    await page.reload({ waitUntil: 'networkidle0' })
    await waitText(page, 'No evaluations yet')
    assert.ok(!(await page.evaluate(() => document.body.innerText.includes('Name (optional)'))))
    assert.ok(existsSync(join(downloads, zipName)))
  } catch (error) {
    problems.push(String(error?.stack ?? error))
    await page.screenshot({ path: join(SHOTS, 'flow-failure.png'), fullPage: true }).catch(() => {})
  }
  if (errors.length) problems.push(`Page errors: ${errors.join(' | ')}`)
  await context.close()
  return { name: 'flow: onboarding -> truck -> component -> finalize -> export', problems }
}
