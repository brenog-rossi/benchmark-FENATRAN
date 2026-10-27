// prefers-reduced-motion: reduce must remove movement (slides, sheet slide-up, layout and
// accordion animations) and CSS transitions; content must appear without waiting for motion.
import { join } from 'node:path'
import { clickText, ensureDir, makePhotos, newPage, onboard, typeInto, waitText } from './lib.mjs'

// Samples an element's transform and height over a few frames right after an interaction.
function sample(selector) {
  return new Promise((ok) => {
    const frames = []
    let ticks = 0
    const tick = () => {
      ticks += 1
      const all = document.querySelectorAll(selector)
      const el = all[all.length - 1]
      if (el) {
        frames.push({
          transform: getComputedStyle(el).transform,
          height: Math.round(el.getBoundingClientRect().height),
        })
      }
      if (frames.length < 6 && ticks < 120) requestAnimationFrame(tick)
      else ok(frames)
    }
    tick()
  })
}

const moving = (frames) =>
  frames.some((f) => f.transform !== 'none' && f.transform !== 'matrix(1, 0, 0, 1, 0, 0)')

export async function runReducedMotion({ browser, url, tmp }) {
  const problems = []
  const { page, context, errors } = await newPage(browser)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  try {
    await page.goto(url, { waitUntil: 'networkidle0' })
    await waitText(page, 'Name (optional)')
    await typeInto(page, 'Name (optional)', 'Reduced Motion')
    const stepFrames = await page.evaluate(sample, '.onboarding__step')
    if (moving(stepFrames)) {
      problems.push(`onboarding step moves: ${stepFrames.map((f) => f.transform).join(' / ')}`)
    }

    const button = await page.$eval('.btn', (el) => getComputedStyle(el).transitionDuration)
    if (!button.split(',').every((d) => parseFloat(d) <= 0.001)) {
      problems.push(`CSS transition not reduced: ${button}`)
    }

    await onboard(page, url)
    await clickText(page, 'New evaluation')
    await clickText(
      page,
      'TruckBrand, model, brochure and feature review with scores 0-5.',
      'button',
    )
    await page.waitForSelector('.feature__toggle')

    // Feature 1 is open by default; open feature 2 and sample its body (the last one).
    await (await page.$$('.feature__toggle'))[1].click()
    const frames = await page.evaluate(sample, '.feature__body')
    // The body may be sampled once before it lays out (height 0); an animation shows in-between heights.
    if (new Set(frames.map((f) => f.height).filter((h) => h > 0)).size > 1) {
      problems.push(`accordion height animates: ${frames.map((f) => f.height).join(',')}`)
    }

    const bodies = await page.$$('.feature__body')
    const options = await bodies[bodies.length - 1].$$('.rating__option')
    await options[1].click()
    await page.waitForSelector('.rating__indicator')
    await options[4].click()
    if (moving(await page.evaluate(sample, '.rating__indicator'))) {
      problems.push('score indicator moves with reduced motion')
    }

    const [photo] = await makePhotos(page, ensureDir(join(tmp, 'fixtures-motion')), 1)
    const input = await page.$('section[aria-label="Brochure photos"] input[type="file"][multiple]')
    await input.uploadFile(photo)
    await page.waitForSelector('section[aria-label="Brochure photos"] .media-tile')
    await (await page.$('section[aria-label="Brochure photos"] .media-tile')).click()
    if (moving(await page.evaluate(sample, '.overlay__panel'))) {
      problems.push('sheet slides up with reduced motion')
    }
  } catch (error) {
    problems.push(String(error?.stack ?? error))
  }
  if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`)
  await context.close()
  return { name: 'reduced motion', problems }
}
