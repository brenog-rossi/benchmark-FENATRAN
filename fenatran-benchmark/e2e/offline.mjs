// Offline: first visit online installs the service worker; then the server is stopped and the
// browser is put offline, and the app must load and work from the precache.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { clickText, newPage, onboard, SHOTS, startServer, typeInto, waitText } from './lib.mjs'

export async function runOffline({ browser }) {
  const problems = []
  const server = await startServer()
  const { page, context, errors } = await newPage(browser)
  let stopped = false
  try {
    await page.goto(server.url, { waitUntil: 'networkidle0' })
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, {
      timeout: 15_000,
    })
    const cached = await page.evaluate(async () => {
      let count = 0
      for (const name of await caches.keys())
        count += (await (await caches.open(name)).keys()).length
      return count
    })
    assert.ok(cached > 5, `precache has entries (${cached})`)

    await server.close()
    stopped = true
    await page.setOfflineMode(true)
    const reachable = await page.evaluate(() =>
      fetch(`not-cached-${Date.now()}.txt`).then(
        () => true,
        () => false,
      ),
    )
    assert.equal(reachable, false, 'network must be unreachable')
    assert.equal(await page.evaluate(() => navigator.onLine), false)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await onboard(page, page.url())
    await clickText(page, 'New evaluation')
    await clickText(
      page,
      'ComponentComponent name, manufacturer, images and observations.',
      'button',
    )
    await typeInto(page, 'Component', 'Offline headlamp')
    await waitText(page, 'All changes saved', 15_000)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitText(page, 'Offline headlamp')
    await page.screenshot({ path: join(SHOTS, 'offline.png') })
  } catch (error) {
    problems.push(String(error?.stack ?? error))
    await page.screenshot({ path: join(SHOTS, 'offline-failure.png') }).catch(() => {})
  }
  const real = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e))
  if (real.length) problems.push(`page errors: ${real.join(' | ')}`)
  await context.close()
  if (!stopped) await server.close()
  return { name: 'offline: service worker precache + setOfflineMode', problems }
}
