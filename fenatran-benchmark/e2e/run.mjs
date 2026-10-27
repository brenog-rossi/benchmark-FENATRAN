// Quality checks against the production build: node e2e/run.mjs [flow] [responsive] [a11y] [offline] [motion]
// Requires `npm run build` first and Microsoft Edge (EDGE_PATH to override).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runA11y } from './a11y.mjs'
import { runFlow } from './flows.mjs'
import { ensureDir, launch, report, SHOTS, startServer } from './lib.mjs'
import { runOffline } from './offline.mjs'
import { runReducedMotion } from './motion.mjs'
import { runResponsive } from './responsive.mjs'

const SUITES = {
  flow: runFlow,
  responsive: runResponsive,
  a11y: runA11y,
  offline: runOffline,
  motion: runReducedMotion,
}

const wanted = process.argv.slice(2)
const names = wanted.length ? wanted : Object.keys(SUITES)
ensureDir(SHOTS)
const tmp = mkdtempSync(join(tmpdir(), 'fenatran-e2e-'))
const server = await startServer()
const browser = await launch()
const results = []
try {
  for (const name of names) {
    const suite = SUITES[name]
    if (!suite) throw new Error(`Unknown suite ${name}`)
    console.log(`Running ${name}...`)
    const out = await suite({ browser, url: server.url, tmp })
    results.push(...(Array.isArray(out) ? out : [out]))
  }
} finally {
  await browser.close()
  await server.close()
  rmSync(tmp, { recursive: true, force: true })
}
const failed = report(results)
console.log(`${results.length - failed} passed, ${failed} failed. Screenshots: e2e/screenshots/`)
process.exit(failed ? 1 : 0)
