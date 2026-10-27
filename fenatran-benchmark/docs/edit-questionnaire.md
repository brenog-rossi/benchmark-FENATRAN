# Editing the questionnaire

All editable benchmark content lives in one file: `src/config/questionnaire.ts`. This guide explains what each part controls and what must be updated with it.

## What is in the file

| Export           | Controls                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| `QUESTIONNAIRE_VERSION` | Version written to every `data.json` as `questionnaireVersion` (currently `'2026.1'`). |
| `OTHER`                 | The label `'Other'`. Used in BRANDS. Choosing it opens a free-text field. |
| `SCALE`                 | Score range (`min` 0, `max` 5) and the labels for 0 and 5.                     |
| `BRANDS`                | Options for the truck **Brand** field.                                         |
| `FEATURES`              | The truck feature review: one card per feature, each with a stable `id` and a `title`. |

The file is plain TypeScript arrays and objects. The UI, the validation schemas and the export read them directly, so no other file needs a copy of the lists.

## Changing the lists

- **Brands**: add, remove or rename entries. Keep `OTHER` as the last entry. It must stay in the list, because the free-text field `brandOther` depends on it.
- **Features**: add, remove, rename or reorder entries in `FEATURES`. Each feature needs:
  - `id`: a unique, stable, kebab-case identifier. Scores and comments are stored by `id`. Do not rename an `id` for an existing feature, because older evaluations would lose their answers for it.
  - `title`: the text shown on the card and in the export.
- **Scale**: `SCALE.min` and `SCALE.max` define the score range. The `Score` type in `src/data/types.ts` and the score schema in `src/data/schemas.ts` also fix the range to 0 to 5. Changing the scale therefore needs code changes in those files, not only in `questionnaire.ts`.

Do not change `OTHER` itself. The code compares against it by value.

## Versions

- `QUESTIONNAIRE_VERSION`: bump it when features or the scale change. The value is written to each `data.json` as `questionnaireVersion`, so a report builder can tell which questionnaire an export came from. Nothing in the app compares it, and changing it does not alter existing evaluations.

## What must be updated with a change

After any change to `questionnaire.ts`, update these items in the same commit:

1. **Tests with hard-coded counts.** They check the number of features and must match the new list:
   - `src/data/data.test.ts`: `toHaveLength(13)` (around line 45).
   - `src/features/export/builders.test.ts`: `toHaveLength(13)` (around line 160) and the text `"2 of 13"` (around line 210).
   - `src/features/evaluation/evaluation.test.tsx`: the text `"1 of 13"` (around line 399).
   - `src/features/home/home.test.tsx`: the text `"1 of 13 scored"` (around line 91).

   Replace the number with the new count. Search for `13` in these files before you finish.

2. **Version constant.** Bump `QUESTIONNAIRE_VERSION` as described above. Tests that use `questionnaireVersion: '2026.1'` (`src/features/export/builders.test.ts`) must match the new value if they check it.

3. **Export.** No code change is needed for the export, because `builders/json.ts` reads `FEATURES` and `SCALE`. Check the output anyway:
   - `data.json` has `questionnaire.scale` and `questionnaire.features` with the new list.
   - The `Feature scores` sheet in `summary.xlsx` has one row per feature for each truck.
   - `summary.md` shows the features in the new order.

4. **Documentation.** Update `docs/data-schema.md` if the list of features or the version values it quotes have changed, and add a line to `CHANGELOG.md`.

5. **Checks.** Run:

   ```powershell
   npm run coverage   # must stay at 100 %
   npm run lint
   npm run build
   ```

   Optionally run `npm run quality` to regenerate the screenshots in `e2e/screenshots/` (git-ignored).

## Open points

- Removing a feature hides its answers in the UI, `summary.md` and the `Feature scores` sheet, because those iterate `FEATURES`. The raw answers stay in the evaluation records inside `data.json`. Keep this in mind before removing features from a benchmark that already has data.
