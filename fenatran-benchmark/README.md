# FENATRAN 2026 Benchmark

An offline web app (PWA) for evaluating trucks and components at the FENATRAN 2026 fair. Each evaluator records truck and component evaluations on a phone, with photos, videos, voice notes and scores, and exports them as one ZIP file to share with the team's WhatsApp group.

The app works without a network connection once it has been opened online one time. All data stays on the device until the evaluator exports it.

User documentation for the fair: [docs/user-guide.md](docs/user-guide.md).

Published app: <https://brenog-rossi.github.io/benchmark-FENATRAN/>. If your network blocks that address, run the app locally (see [Run the production build locally](#run-the-production-build-locally)).

## What it does

- Profile on one page: e-mail (required) and name (optional).
- Truck evaluation: brand, model, brochure photos, and 13 scored features (0 to 5), each with a comment and media.
- Component evaluation: name, manufacturer, images, videos, voice notes, and comments.
- Media: camera, gallery, video, voice notes, photo mark-up (the original is kept), and captions.
- Finalize, export, and share: one ZIP with `data.json`, `gallery.json`, `summary.md`, `summary.xlsx` and the media in original quality, sent with the Web Share API (download as fallback). Exports above 100 MiB can be split into parts.
- Gallery feed: `gallery.json` lists every captioned photo and video with its evaluation context, ready for a photo carousel.
- Wipe after sending: "I sent everything" deletes evaluations and media and keeps the profile.

The questionnaire (features and brands) lives in `src/config/questionnaire.ts`. See [docs/edit-questionnaire.md](docs/edit-questionnaire.md).

The export format is described in [docs/data-schema.md](docs/data-schema.md).

## Stack

React 19, TypeScript (strict), Vite, Motion, Dexie (IndexedDB), zod, react-hook-form, vite-plugin-pwa, fflate (ZIP), write-excel-file. Tests with Vitest and jsdom; end-to-end checks with puppeteer-core and axe.

## Requirements

- Node.js 24 (LTS) and npm. CI uses Node 24.
- Install with `npm install --legacy-peer-deps`. The flag is required because of optional peer dependencies of `@hookform/resolvers`. CI uses `npm ci --legacy-peer-deps`.
- For the end-to-end checks only: Microsoft Edge. The default path is `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Set the `EDGE_PATH` environment variable to use another path.

## Run

```powershell
npm install --legacy-peer-deps
npm run dev
```

The dev server starts Vite on a local URL (printed in the terminal).

## Build

```powershell
npm run build
```

Runs `tsc -b` and then `vite build`. The output goes to `dist/`, which contains the PWA service worker and the precache manifest.

To check the production build locally, run `npm run preview`.

### Run the production build locally

Use this on a computer whose network blocks the published address. It serves the same build as GitHub Pages:

```powershell
npm install --legacy-peer-deps
npm run build
npx vite preview --port 4173 --strictPort
```

Then open <http://localhost:4173>. Data saved there stays in that computer's browser and is separate from the data on your phone. Use it for review and demos; record fair evaluations on the phone.

## Test

```powershell
npm run coverage
```

Runs Vitest with coverage. The thresholds are 100 % for lines, branches, functions and statements, and the run fails below them. Excluded from coverage: `src/main.tsx`, `src/test/**`, `*.d.ts`, the `index.ts` barrels and `src/data/types.ts`. Do not add exclusions to pass the threshold.

Plain `npm test` runs the tests without the coverage report.

## Lint

```powershell
npm run lint
```

Runs ESLint on the project and `prettier --check .`, which also checks the Markdown files. Use `npm run format` to fix formatting.

## End-to-end checks

```powershell
npm run quality
```

Builds the app and then runs the browser suites in `e2e/` against `dist/`, using Microsoft Edge in headless mode. The suites are:

| Suite        | What it checks                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `flow`       | Full user flow: profile, truck, component, finalize, ZIP export (with `gallery.json`) and wipe.                               |
| `responsive` | No horizontal overflow and tap targets of at least 44 px at 6 viewports. Writes screenshots to `e2e/screenshots/<viewport>/`. |
| `a11y`       | axe (WCAG 2.0, 2.1 AA and best practice) on every screen.                                                                     |
| `offline`    | Service worker precache, then reload with the network off.                                                                    |
| `motion`     | Reduced motion: no movement between frames.                                                                                   |

To run one or more suites: `node e2e/run.mjs flow a11y`. `npm run e2e` runs all suites without building first and needs an existing `dist/`.

After a deploy, run the suites against the published site with `E2E_URL`:

```powershell
$env:E2E_URL = 'https://brenog-rossi.github.io/benchmark-FENATRAN/'
node e2e/run.mjs flow responsive a11y motion
```

The `offline` suite always uses the local `dist/`, because it needs to switch the network off.

The Edge path is set in `e2e/lib.mjs`. The screenshots are git-ignored.

## Deploy (GitHub Pages)

The workflow `.github/workflows/deploy-pages.yml` (at the repository root, one level above this folder) builds the app in `fenatran-benchmark/` and publishes `dist/` to GitHub Pages. It runs on a push to `main` and can also be started by hand from the Actions tab.

The app uses `base: './'` in `vite.config.ts` and HashRouter (`#/` routes). This means it works under any Pages path, with no server rewrites needed.

The Pages site must be set to deploy from GitHub Actions in the repository settings.

## CI

`.github/workflows/ci.yml` (at the repository root) runs on push and pull requests: `npm run lint`, `npm run coverage`, `npm run build`. The end-to-end suites are not run in CI; run `npm run quality` locally before a release.

## Offline behaviour

- The service worker (vite-plugin-pwa, `registerType: 'autoUpdate'`) precaches the app shell, fonts and icons on the first online visit. A new deploy is picked up on the next online visit.
- Data is stored on the device in IndexedDB (database `fenatran-benchmark-2026`): profile, evaluations and media (photos are resized to at most 4096 px on capture).
- When the profile is first saved, the app asks the browser for persistent storage (`navigator.storage.persist()`). The browser may still clear data under storage pressure, so export daily.
- Nothing is sent to a server. The only outbound action is the user's own share or download.

## Project layout

```
src/app/            App shell, routes (HashRouter), layout CSS
src/components/ui/  UI kit (Button, Dialog, RatingScale, ...)
src/config/         questionnaire.ts (features, brands, versions)
src/data/           types, zod schemas, Dexie db, repositories
src/design/         tokens, typography, motion variants
src/features/       onboarding (profile), home, evaluation, media, export
src/hooks/          useProfile, useEvaluations, useAutosave, ...
src/lib/            image, format, slug, storage, zod setup, ...
e2e/                browser checks (run.mjs, lib.mjs, suites)
docs/               architecture, guides, final handover
```

## Known limitations

- Web Share with files, camera and microphone capture, and the install prompt have been checked on desktop Edge only. They still need a test on iPhone Safari and Android Chrome.
- The end-to-end suites run on Chromium only; WebKit is not covered.
- Zipping runs on the main thread, so very large exports can freeze the screen for a moment.
- Photos are exported in original quality, so ZIP files are larger. Export daily; large exports are split into parts.
- HEIC photos are converted to JPEG on export when the browser can decode them; otherwise the HEIC file is kept.
- Media that is no longer referenced by an evaluation is still exported (it is not cleaned up).

## Documentation

- [docs/user-guide.md](docs/user-guide.md): how to use the app at the fair.
- [docs/edit-questionnaire.md](docs/edit-questionnaire.md): how to change the questionnaire.
- [docs/data-schema.md](docs/data-schema.md): export format (`data.json`, `gallery.json`).
- [docs/architecture.md](docs/architecture.md): design.
- [process.md](process.md) and [CLAUDE.md](CLAUDE.md): development, test and fix process.
- [CHANGELOG.md](CHANGELOG.md): version history.
