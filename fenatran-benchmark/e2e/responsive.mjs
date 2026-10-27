// Screenshots at the six target resolutions plus layout checks on every main screen:
// no horizontal scroll, no empty side margins, tap targets >= 44 px.
import { join } from 'node:path'
import { ensureDir, newPage, SHOTS, VIEWPORTS } from './lib.mjs'
import { walkScreens } from './screens.mjs'

export function layoutProblems() {
  const problems = []
  const doc = document.documentElement
  const vw = doc.clientWidth
  if (doc.scrollWidth > vw + 1) problems.push(`horizontal scroll: ${doc.scrollWidth} > ${vw}`)

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }

  // body has overflow-x: hidden, so also look for content cut off at the right edge.
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') return true
    }
    return false
  }
  const overflowing = [...document.querySelectorAll('body *')].filter((el) => {
    if (el.classList.contains('visually-hidden') || !visible(el)) return false
    const r = el.getBoundingClientRect()
    return (r.right > vw + 1 || r.left < -1) && !clipped(el)
  })
  for (const el of overflowing.slice(0, 3)) {
    const r = el.getBoundingClientRect()
    problems.push(
      `overflows viewport: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(r.left)}..${Math.round(r.right)}`,
    )
  }
  for (const sel of ['.shell__header', '.shell__main', '.shell__footer']) {
    const el = document.querySelector(sel)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (Math.abs(r.left) > 1 || Math.abs(r.right - vw) > 1) {
      problems.push(
        `${sel} not full width (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`,
      )
    }
  }

  // Each visible content column must use the width of the pane it sits in.
  const roots = [
    ...document.querySelectorAll(
      '.twopane__list > *, .twopane__detail > *, .onboarding__step, .onboarding__actions',
    ),
  ].filter(visible)
  for (const el of roots) {
    const parent = el.parentElement
    const ps = getComputedStyle(parent)
    const inner = parent.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight)
    const fill = el.getBoundingClientRect().width / inner
    if (fill < 0.9) {
      problems.push(
        `empty side margin: .${el.className.split(' ')[0]} uses ${Math.round(fill * 100)} % of its pane`,
      )
    }
  }

  const targets = document.querySelectorAll(
    'a[href], button, select, input:not([type="hidden"]), textarea, [role="button"]',
  )
  for (const el of targets) {
    const hidden = el.matches('input[type="file"], input[type="radio"], input[type="checkbox"]')
    const box = hidden ? (el.closest('label') ?? el) : el
    if (!visible(box)) continue
    if (el.closest('[aria-hidden="true"]')) continue
    const r = box.getBoundingClientRect()
    if (r.height < 44 - 0.5 || r.width < 44 - 0.5) {
      const text = (box.getAttribute('aria-label') ?? box.textContent ?? '').trim().slice(0, 40)
      problems.push(
        `tap target ${Math.round(r.width)}x${Math.round(r.height)}: <${box.tagName.toLowerCase()} class="${box.className}"> "${text}"`,
      )
    }
  }
  return problems
}

export async function runResponsive({ browser, url, tmp }) {
  const results = []
  const fixtures = ensureDir(join(tmp, 'fixtures-responsive'))
  for (const viewport of VIEWPORTS) {
    const problems = []
    const { page, context, errors } = await newPage(browser, viewport)
    const dir = ensureDir(join(SHOTS, viewport.name))
    try {
      await walkScreens(page, url, fixtures, async (screen) => {
        await page.screenshot({ path: join(dir, `${screen}.png`) })
        const found = await page.evaluate(layoutProblems)
        problems.push(...[...new Set(found)].map((p) => `${screen}: ${p}`))
      })
    } catch (error) {
      problems.push(String(error?.stack ?? error))
      await page.screenshot({ path: join(dir, 'failure.png'), fullPage: true }).catch(() => {})
    }
    if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`)
    await context.close()
    results.push({ name: `responsive ${viewport.name}`, problems })
  }
  return results
}
