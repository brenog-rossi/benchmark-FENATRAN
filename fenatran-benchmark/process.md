# Process - development, tests and fixes

All commands run from `fenatran-benchmark/` (PowerShell). Install with `npm install --legacy-peer-deps`.

## 1. Every session

1. Read `CLAUDE.md`, `docs/architecture.md` and `docs/handover-final.md` (open issues, status).
2. Work only on the agreed scope. Keep changes small and surgical.
3. Finish with lint, coverage and build green (section 5).
4. Update the docs the change affects (section 6).
5. Never push without explicit approval from the product owner.

## 2. Development

- Structure follows `docs/architecture.md` section 4: `src/app`, `components/ui`, `config`, `data`, `design`, `features/*`, `hooks`, `lib`.
- TypeScript strict (`noUncheckedIndexedAccess`). Validate data with zod (`src/data/schemas.ts`); persist through the repositories in `src/data/repositories`, never straight to Dexie from components.
- Questionnaire content (features, brands, versions) lives only in `src/config/questionnaire.ts`. A change to the export shape also needs `docs/data-schema.md` and `architecture.md` section 5 updated.
- UI uses the kit in `src/components/ui`, tokens in `src/design/tokens.css` and variants in `src/design/motion.ts`. Respect the forbidden items in `CLAUDE.md`. Tap targets at least 44 px; honor reduced motion.
- The app must keep working offline and must not call any server.
- Format with `npm run format`. Comment only code that needs it.

## 3. Tests

- Unit and component tests: Vitest + Testing Library + fake-indexeddb, next to the code (`*.test.ts(x)`). Mock data in `src/test/factories`.
- Coverage threshold is 100 % (lines, branches, functions, statements). Do not add coverage exclusions to pass.
- New behavior needs tests, including edge cases: empty data, "Other" values, accents and special characters, score 0 vs null, large media sets (split), missing MediaRecorder / Web Share / storage APIs, quota and Dexie failures.
- End-to-end: `npm run quality` builds, then runs the Edge suites in `e2e/` against `dist/` (flow, responsive at 6 viewports, a11y with axe, offline, motion). Run it before any release and after UI, routing, PWA or export changes. Run single suites with `node e2e/run.mjs flow a11y`.
- Real-device checks (iPhone Safari, Android Chrome: install, share sheet, camera, offline, WhatsApp, wipe) follow the checklist in `docs/handover-final.md`. Record each result there with date, device and version; never mark an item done without running it.

## 4. Fixes

1. Reproduce the problem first (failing test, or an e2e step for UI behavior).
2. Write the failing regression test, then fix the root cause with the smallest change.
3. Run the full checks (section 5). Fix any bug your change caused or is tightly coupled to; leave unrelated issues alone.
4. New or remaining issues go to "Open issues" in `docs/handover-final.md`. Remove entries you resolved.
5. Add a line to `CHANGELOG.md` for user-visible fixes.

## 5. Checks before finishing

```powershell
npm run lint        # ESLint + Prettier (also checks Markdown outside docs/)
npm run coverage    # Vitest, 100 % thresholds
npm run build       # tsc -b + vite build (PWA)
npm run quality     # e2e, when UI/PWA/export changed
```

CI (`.github/workflows/ci.yml`) runs lint, coverage and build on push and PRs. E2E is local only.

## 6. Documentation upkeep

- Keep `README.md`, `docs/user-guide.md`, `docs/edit-questionnaire.md`, `docs/data-schema.md` and `docs/architecture.md` in sync with the code.
- Status and open issues live in `docs/handover-final.md`; update it instead of creating per-session handovers.

## 7. Release and deploy

Only after approval: push to `main` triggers `deploy-pages.yml` (GitHub Pages; HashRouter and `base: './'`). Then open the URL on a phone without GitHub login, open it once online so the service worker caches the app, and run the device checklist.
