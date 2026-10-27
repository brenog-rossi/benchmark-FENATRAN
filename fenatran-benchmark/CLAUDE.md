# CLAUDE.md - FENATRAN 2026 Benchmark

## Project

Offline web app (PWA) for evaluating trucks and components at the FENATRAN 2026 fair. Each evaluator records evaluations on a phone (13 scored features 0 to 5, comments, photos, videos, voice notes) and exports them as one ZIP (`data.json`, `gallery.json`, `summary.md`, `summary.xlsx`, media in original quality) shared to the team's WhatsApp group. Data stays on the device (IndexedDB) until exported; nothing is sent to a server.

Stack: React 19, TypeScript strict, Vite, Dexie, zod, react-hook-form, Motion, vite-plugin-pwa, fflate, write-excel-file. Tests: Vitest (100 % coverage) and puppeteer-core + axe (e2e).

Status: v2 finished locally. Pending: deploy to GitHub Pages (needs explicit approval) and real-device tests. See `docs/handover-final.md`.

## Before any work

**Read [process.md](process.md).** It defines how to develop, test and fix. Follow it for every session.

## Hard rules

- Do not push or deploy without explicit approval from the product owner.
- This repository is public. Keep the app, exports and docs generic: no company names (except as a truck brand option), no confidentiality labels, no internal links, no personal data.
- All work happens inside this repository folder. Confidential or restricted material (internal guides, backups, curator tools, real exports) goes in `fenatran-internal/` at the repo root, which is git-ignored. Add any other sensitive file to `.gitignore` before creating it, and check `git status --ignored` before committing.- No emojis, bento grids, gradients or Lucide icons in the UI. Do not add licensed font files.

## Documentation map

- `process.md`: Development, testing and fix process (start here)
- `README.md`: Run, build, test, deploy
- `docs/architecture.md`: Requirements, stack, folders, data model, design system
- `docs/data-schema.md`: Export format (`data.json`, `gallery.json`)
- `docs/edit-questionnaire.md`: How to change the questionnaire
- `docs/user-guide.md`: User guide for the fair
- `docs/handover-final.md`: Current status, open issues, device checklist
