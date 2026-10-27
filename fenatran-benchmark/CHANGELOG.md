# Changelog

## v2

- Generic app: no company names, confidentiality labels or legal notices in the app, exports or docs. Font is Inter only.
- Profile on one page: e-mail (required, any domain) and name (optional). Role, area and the consent step are removed. Profiles saved by v1 are upgraded on first open (old fields are dropped).
- Export is one ZIP with photos in original quality. The "reduced quality" option and the separate photo share are removed. HEIC photos are converted to JPEG when the browser can decode them.
- New `gallery.json` in every ZIP: one row per captioned photo or video with the evaluation context (brand, model, feature or component) and the evaluator e-mail and name. It feeds a photo carousel.
- `data.json` schema version 2: `evaluator` is `{ name, email }`; `photoQuality` is always `original`.
- The Profile link is hidden until a profile exists.
- Component example in the form is "battery".
- Docs: published app link, and how to run the production build locally (port 4173) when a network blocks the published address.
- e2e reduced-motion check: ignores one sample taken before layout, so it no longer fails at random on slow machines; it still fails on any real height animation.

## v1

- Offline PWA (React, TypeScript, Vite, Dexie, vite-plugin-pwa) deployed to GitHub Pages.
- Truck evaluation (brand, model, brochure photos, 13 features scored 0 to 5 with comments and media) and component evaluation (name, manufacturer, media, comments).
- Media: camera, gallery, video, voice notes, photo mark-up (the original is kept), captions; photos resized to at most 4096 px with EXIF removed.
- Autosave, edit, delete and finalize with a confirmation summary.
- Export builders: `data.json`, `summary.md`, `summary.xlsx`, `README.txt`, ZIP naming `FENATRAN2026_<name>_<yyyy-mm-dd>[_partXofY].zip`, split above 100 MiB, Web Share with download fallback, wipe after sending.
- Unit tests at 100 % coverage; end-to-end suites (flow, responsive, a11y, offline, reduced motion) on Microsoft Edge.
