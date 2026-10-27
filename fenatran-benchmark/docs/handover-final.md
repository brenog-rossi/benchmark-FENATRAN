# Handover Final (v2)

Status: local checks passed. Deploy and device tests are NOT done. They need explicit approval and a real phone.

## 1. What changed in v2

- Generic app and docs: no company names, confidentiality labels or legal notices. Font is Inter only.
- Profile on one page: e-mail (required) and name (optional). Role, area and consent removed. v1 profiles are upgraded on first open.
- Export: one ZIP, photos in original quality (HEIC converted to JPEG when possible). The separate photo share was removed.
- New `gallery.json` in every ZIP for a photo carousel (see `docs/data-schema.md`, section 8).
- `data.json` schema version 2.
- The Profile link is hidden until a profile exists.

## 2. Results

| Check | Result |
|---|---|
| `npm run lint` (ESLint + Prettier) | Pass |
| `npm run coverage` (100 % thresholds) | Pass, 100 % lines, branches, functions and statements |
| `npm run build` (tsc + vite + PWA) | Pass. Warning: main JS chunk above 500 kB |
| `npm run quality` (Edge e2e) | 11 passed, 0 failed: profile to export flow (checks `gallery.json`), responsive at 6 viewports, axe at 390x844 and 1366x768, offline precache, reduced motion |

## 3. Not done (needs a device or approval)

- Deploy to GitHub Pages: waiting for explicit approval. `deploy-pages.yml` runs on push to `main` or `workflow_dispatch`.
- iPhone Safari and Android Chrome checks (install, profile, share-sheet export, offline).
- WhatsApp send test with original-quality ZIPs and wipe-after-sending.

## 4. Open issues

- No real-device test yet (iPhone Safari, Android Chrome).
- e2e runs on desktop Edge only. No WebKit run.
- `zipSync` runs on the main thread (may stall on large exports).
- Original-quality photos make bigger ZIPs; more exports will be split.
- Orphan media can be exported.
- A list reload failure after delete shows the failure toast.
- Main JS chunk is above 500 kB; code-splitting is a possible follow-up.

## 5. What the team must do at the fair

1. Open the shared link once while online, so the app and offline cache install.
2. Enter your e-mail (name optional) and allow persistent storage.
3. Add an observation to every photo or video you want in the gallery.
4. Export every day with **Export to WhatsApp**.
5. Send each ZIP to the group as a document. If the export is too big, use the split choice.
6. Confirm the files arrived in the group before wiping.
7. Wipe the device data only after the group has the files.

## 6. Device checklist (to run before the fair)

- [ ] Deployed URL opens on iPhone Safari (no GitHub login)
- [ ] Install to home screen works (iPhone and Android)
- [ ] Profile page completes; v1 users are not blocked
- [ ] Create truck and component evaluation, finalize
- [ ] Export through the share sheet (iPhone and Android)
- [ ] Airplane mode after first load: app opens, create and edit an evaluation, reload keeps data
- [ ] Export size: check ZIP size with original photos on a real device
- [ ] WhatsApp send test: every ZIP arrives as a document; photos open at full size
- [ ] `gallery.json` lists the captioned photos and videos
- [ ] Wipe after sending works and clears data

Record each result here with date, device and browser version. Do not mark an item done without running it.