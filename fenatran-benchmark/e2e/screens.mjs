// Walks every main screen once and calls `visit(name)` on each, so the responsive and
// accessibility suites check the same states.
import { clickText, makePhotos, onboard, selectByLabel, typeInto, waitText } from './lib.mjs'

export async function walkScreens(page, url, fixtures, visitScreen) {
  // Lets transitions and toasts settle so checks see the resting layout.
  const visit = async (name) => {
    await new Promise((ok) => setTimeout(ok, 500))
    await visitScreen(name)
  }
  const [photo] = await makePhotos(page, fixtures, 1)
  await page.goto(url, { waitUntil: 'networkidle0' })
  await waitText(page, 'Name (optional)')
  await visit('onboarding')

  await onboard(page, url)
  await visit('home-empty')

  await clickText(page, 'New evaluation')
  await waitText(page, 'What are you evaluating?')
  await visit('type-choice')

  await clickText(page, 'TruckBrand, model, brochure and feature review with scores 0-5.', 'button')
  await page.waitForSelector('.feature__toggle')
  await selectByLabel(page, 'Brand', 'Scania')
  await typeInto(page, 'Model', 'R 450 6x2')
  const input = await page.$('section[aria-label="Brochure photos"] input[type="file"][multiple]')
  await input.uploadFile(photo)
  await page.waitForSelector('section[aria-label="Brochure photos"] .media-tile')
  await page.waitForSelector('.feature__toggle[aria-expanded="true"]')
  await page.waitForSelector('.feature__body .rating__option')
  await (await page.$$('.feature__body .rating__option'))[3].click()
  await waitText(page, 'All changes saved', 15_000)
  await visit('editor-truck')

  await page.$eval('section[aria-label="Brochure photos"] .media-tile', (el) =>
    el.scrollIntoView({ block: 'center' }),
  )
  await (await page.$('section[aria-label="Brochure photos"] .media-tile')).click()
  await page.waitForSelector('[role="dialog"] textarea')
  await new Promise((ok) => setTimeout(ok, 400))
  await visit('media-sheet')
  await clickText(page, 'Done')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))

  await clickText(page, 'Finalize')
  await waitText(page, 'What will be exported')
  await visit('confirm')
  await clickText(page, 'Confirm and finalize')
  await waitText(page, 'Finalized (1)')
  await visit('home-list')

  await page.evaluate(() => {
    location.hash = '#/export'
  })
  await waitText(page, 'Create export')
  await visit('export-options')
  await clickText(page, 'Create export')
  await waitText(page, 'Send to the WhatsApp group', 60_000)
  await visit('export-share')
}
