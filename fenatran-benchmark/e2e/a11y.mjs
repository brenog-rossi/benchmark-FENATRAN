// axe-core accessibility scan (WCAG 2.1 A/AA) of every main screen on a phone and a notebook.
import { join } from 'node:path'
import { AxePuppeteer } from '@axe-core/puppeteer'
import { ensureDir, newPage, VIEWPORTS } from './lib.mjs'
import { walkScreens } from './screens.mjs'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

export async function runA11y({ browser, url, tmp }) {
  const results = []
  const fixtures = ensureDir(join(tmp, 'fixtures-a11y'))
  for (const viewport of VIEWPORTS.filter((v) => ['390x844', '1366x768'].includes(v.name))) {
    const problems = []
    const { page, context } = await newPage(browser, viewport)
    await page.setBypassCSP(true)
    try {
      await walkScreens(page, url, fixtures, async (screen) => {
        const { violations } = await new AxePuppeteer(page).withTags(TAGS).analyze()
        for (const v of violations) {
          const nodes = v.nodes.map((n) => n.target.join(' ')).slice(0, 3)
          problems.push(`${screen}: [${v.impact}] ${v.id} - ${v.help} -> ${nodes.join(', ')}`)
        }
      })
    } catch (error) {
      problems.push(String(error?.stack ?? error))
    }
    await context.close()
    results.push({ name: `axe ${viewport.name}`, problems })
  }
  return results
}
