# Architecture – FENATRAN 2026 Benchmark

Status: v2. Describes the design of the app as built.

## 1. How it works for the user
1. The app is a static website on **GitHub Pages** in a **new repository** (created by the product owner).
   URL: `https://<account>.github.io/<repository>/`.
2. **Before the fair (internet, once):** the evaluator opens the link in Safari/Chrome. The browser keeps an offline copy (service worker). Nothing is installed; no app store.
3. **At the fair (no internet):** the same link loads from the offline copy. Answers and media stay on the device (IndexedDB). Nothing is sent to any server.
4. **End of day:** Export → one ZIP (photos in original quality) shared to the WhatsApp group as a document (the only moment internet is needed).
5. The ZIPs are later read by scripts or tools: `data.json` for reports, `gallery.json` for a photo carousel (out of scope here).

## 2. Requirements
| Topic | Decision |
|---|---|
| Backend / DB | None. Frontend only. Deploy: GitHub Pages (new repo) |
| UI library | React + **Motion** (`motion/react`) as the base for UI/UX motion and gestures |
| Forbidden | Emojis, bento grids, colour gradients, Lucide icons |
| Icons | Material Symbols (`@material-symbols/svg-400`, bundled SVG, offline) |
| Language | English |
| Devices | Phone, tablet, notebook. iPhone + Android. No install. Weak/no internet |
| Responsive targets | 360×800, 390×844, 430×932, 768×1024, 1366×768, 1920×1080 |
| Screen usage | Full-bleed, no empty white margins. Mobile: single column, primary action fixed at bottom. ≥1024 px: two panes (list / editor) |
| Font | Inter (`@fontsource/inter`, bundled, offline) |
| Users | 50–150 evaluators; 1 person per device |
| Mandatory fields | Profile: e-mail (name optional); truck: brand + model; component: name. All scores optional |
| Saving | Autosave; edit/delete allowed, also after "Finalize" |
| Security | No password; no server; CSP `connect-src 'self'`; `noindex` |

### User flow
```
PROFILE:    one page: E-mail (required, mask + validation) + Name (optional) → Start
EVALUATION: [New evaluation] → choose TRUCK | COMPONENT
  TRUCK:     Brand (list + Other) → Model → Brochure photos (optional, many)
             → Feature review, per feature: score 0–5 → comment → photos
  COMPONENT: Component name → Manufacturer → Images → Comments/observations
→ Finalize → Confirmation → Export to WhatsApp
EXPORT:     FENATRAN2026_<Name>_<yyyy-mm-dd>.zip (all of the day's content, original photos)
```

### Lists (editable in `src/config/questionnaire.ts`)
- **Brands:** Volvo, Mercedes-Benz, Scania, DAF, Iveco, Volkswagen, Foton, Sinotruk, XCMG, BYD, JAC, Sany, Other (free text)
- **Score scale:** 0–5 (0 = very poor / not present, 5 = excellent); empty = not scored
- **Features:**
  1. Robustness and quality of chassis solutions and mounted parts (tanks, cross members, battery box, etc.)
  2. Quality of cable, pneumatic line and connector installation
  3. Cab quality impression: gaps and flushes between panels
  4. Suspension installation (front, rear and cab)
  5. Comfort getting in and out of the vehicle
  6. Overall impression of the cab interior
  7. Driver and passenger seats
  8. Steering adjustments
  9. Interior convenience items (air conditioning, parking cooler, fridge, etc.)
  10. Bed
  11. Cab space and ease of movement inside
  12. Interior storage space
  13. Multimedia screen

### Media
Camera photo, gallery, video, audio (voice note), draw/mark-up on photo (keeps original). No limits.
Original kept on device (photo re-encoded ≤ 4096 px, EXIF/GPS removed) and exported as stored. HEIC is converted to JPEG on export when the browser can decode it.

### Export
- One ZIP with everything on the device: `data.json`, `gallery.json`, `summary.md`, `summary.xlsx`, `README.txt`, `media/<nn_evaluation>/<role>_<feature>_<nn>_<caption-slug>.<ext>` (photos, videos, audio).
- ZIP too big for WhatsApp (> 100 MB): ask **split into parts / export without videos / go back**. Each part is a valid ZIP with `data.json`.
- `gallery.json`: one flat row per captioned photo/video in that part (caption, evaluation context, evaluator e-mail and name). Feeds a carousel without parsing `data.json`.
- No separate photo share: WhatsApp drops captions and compresses photos. The ZIP, sent as a document, keeps both.
- Data deleted from the device **only after the user confirms** it was sent.

## 3. Stack
| Layer | Choice | Reason |
|---|---|---|
| Build | Vite + React + TypeScript (strict) | Static output for Pages |
| Motion | `motion` (`import { motion, AnimatePresence } from "motion/react"`) | Requirement |
| Routing | React Router `HashRouter` | Works on Pages without server rewrites |
| Forms | react-hook-form + zod | Validation; same schemas validate `data.json` |
| E-mail mask | Own `maskEmail` helper (lowercase, no spaces, single `@`) | Small, testable |
| State | Zustand | Simple |
| Storage | Dexie (IndexedDB) + `navigator.storage.persist()` | Blobs offline |
| Offline | `vite-plugin-pwa` (Workbox precache, `registerType: 'autoUpdate'`) | Offline after first visit |
| ZIP | `fflate` | Small, fast |
| Excel | `write-excel-file` | Light; avoids outdated SheetJS npm package |
| Images | Own canvas utilities | Resize + strip EXIF |
| Icons | `@material-symbols/svg-400` | Allowed set |
| Unit tests | Vitest + Testing Library + `fake-indexeddb`, v8 coverage **100 %** thresholds | Requirement |
| Quality | `puppeteer-core` driving the installed **Microsoft Edge** + `@axe-core/puppeteer` | No Chromium download behind proxy |
| Lint | ESLint (typescript-eslint, react-hooks) + Prettier | |
| CI/CD | GitHub Actions: lint → test → build → deploy Pages | |
| Dev env | Node.js LTS **portable** in `%USERPROFILE%\tools\node` (no admin) | Approved |

## 4. Folder structure
```
fenatran-benchmark/
├─ .github/workflows/      ci.yml, deploy-pages.yml
├─ docs/                   architecture.md, data-schema.md, user-guide.md, edit-questionnaire.md, handover-final.md, images/
├─ public/                 PWA icons, robots.txt (Disallow: /)
├─ e2e/                    puppeteer: flows/, responsive/, a11y/, screenshots/ (git-ignored)
├─ src/
│  ├─ app/                 App.tsx, routes.tsx, providers.tsx, AppShell.tsx
│  ├─ config/              questionnaire.ts  ← features, scale, brands (editable)
│  ├─ design/              tokens.css, typography.css, fonts.css, motion.ts (variants, transitions)
│  ├─ components/ui/       Button, TextField, EmailField, Select, Checkbox, RatingScale,
│  │                       Stepper, Sheet, Dialog, Progress, Icon, Toast, EmptyState
│  ├─ features/
│  │  ├─ onboarding/       OnboardingFlow.tsx (one-page profile), ProfileGate, EditProfile
│  │  ├─ home/             HomeScreen, EvaluationList, StorageMeter
│  │  ├─ evaluation/       TypeChoice, truck/(BrandModel, Brochure, FeatureReview, FeatureCard),
│  │  │                    component/(ComponentForm), Summary, FinalizeConfirm, schema.ts
│  │  ├─ media/            CapturePhoto, PickGallery, RecordVideo, VoiceRecorder, PhotoAnnotator, MediaGrid
│  │  └─ export/           ExportFlow, BigZipDialog, ShareStep, WipeConfirm,
│  │                       builders/(model.ts, json.ts, gallery.ts, markdown.ts, excel.ts, zip.ts, split.ts), share.ts
│  ├─ data/                db.ts (Dexie), repositories/(profile, evaluation, media), types.ts, schemas.ts
│  ├─ lib/                 image.ts, emailMask.ts, slug.ts, format.ts, storage.ts, ids.ts
│  ├─ hooks/               useAutosave, useStorageEstimate, useMediaRecorder, useOnline
│  └─ test/                setup.ts, factories/ (mock data), fixtures/
├─ index.html  vite.config.ts  vitest.config.ts  tsconfig.json  package.json
```
Rule: features import from `components/`, `data/`, `lib/`, `hooks/`, `config/`; never from another feature (except via `app/routes.tsx`).

## 5. Data model
```ts
type Profile = { name: string; email: string };   // name may be ''

type FeatureAnswer = { score: 0|1|2|3|4|5|null; comment: string; mediaIds: string[] };

type Evaluation = {
  id: string; kind: 'truck'|'component'; status: 'draft'|'finalized';
  createdAt: string; updatedAt: string; finalizedAt?: string;
  truck?: { brand: string; brandOther?: string; model: string;
            brochureMediaIds: string[]; features: Record<string, FeatureAnswer> };
  component?: { name: string; manufacturer: string; mediaIds: string[]; comments: string };
};

type Media = { id: string; evaluationId: string; featureId?: string;
  role: 'brochure'|'feature'|'component'; type: 'photo'|'video'|'audio';
  mime: string; blob: Blob; caption: string; durationSec?: number;
  annotatedFromId?: string; createdAt: string };
```
Dexie DB `fenatran-benchmark-2026`, stores: `profile`, `evaluations`, `media` (index `evaluationId`). Version 2 upgrades a v1 profile by dropping every field except `name` and `email`.

`data.json` and `gallery.json` (documented in `docs/data-schema.md`):
```
{ schema: "fenatran-benchmark", schemaVersion: 2, questionnaireVersion, exportId, exportedAt,
  part, totalParts, photoQuality: "original", videosIncluded,
  questionnaire: { scale, features[] }, evaluator: { name, email },
  evaluations: [ Evaluation + media: [{ id, file, type, role, featureId, caption, part }] ] }
```

## 6. Design system
| Token | Value | Use |
|---|---|---|
| `--c-navy` | `#202A44` | header, primary buttons, titles |
| `--c-grey` | `#53565A` | body text |
| `--c-light` | `#E8E5E3` | surfaces, dividers |
| `--c-silver` | `#A7A8A9` | borders, disabled |
| `--c-teal` | `#678C96` | accents, selected score |
| `--c-teal-dark` | `#396976` | links, focus ring |
| `--c-mint` | `#8DC9BF` | success |
| `--c-white` | `#FFFFFF` | background |
| `--c-danger` | `#B3261E` | destructive |
- Flat colours only (no gradients). Radius 4 px. Spacing scale 4/8/12/16/24/32.
- Typography: titles `Inter 500`; body `Inter 300/400`.
- Navy title bar, uppercase small section labels, a neutral footer line "Your data stays on this device until you export it".

## 7. Motion guidelines
- Profile: one page, no step animation.
- Score selector: segmented 0–5 with shared `layoutId` indicator.
- Sheets/dialogs: slide up on mobile, fade/scale on desktop.
- Lists: `layout` animations on add/remove.
- Durations 150–250 ms, spring for position; `useReducedMotion` disables non-essential motion.

## 8. Risks
| Risk | Mitigation |
|---|---|
| WhatsApp compresses photos and drops captions | Only the ZIP is shared, as a document; captions are in `data.json`, `gallery.json` and file names |
| Original photos make bigger ZIPs | Split above 100 MiB; export daily |
| iOS Safari evicts data after ~7 days unused | `persist()`, storage meter, "export daily" tip |
| First visit needs internet | Instructions: open link before the fair |
| Pages may require a GitHub login on managed accounts | Test on a phone without login; use a public Pages account if needed |
