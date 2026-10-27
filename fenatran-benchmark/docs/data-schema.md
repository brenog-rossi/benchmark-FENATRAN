# Data schema for the FENATRAN 2026 export

This document describes what the app exports, so an AI agent or a script can build a report or a photo carousel from it. Every name, type and rule below comes from the code in `src/data/types.ts` and `src/features/export/`. If the code changes, update this file.

## 1. Export overview

Each export creates one or more ZIP files. Every ZIP is self-contained:

```
FENATRAN2026_<Evaluator_Name>_<yyyy-mm-dd>.zip                 (single part)
FENATRAN2026_<Evaluator_Name>_<yyyy-mm-dd>_part<N>of<T>.zip    (split export)
```

- `<Evaluator_Name>`: the profile name, slugified (ASCII, `_` as separator, max 40 characters). When the name is empty, the part of the e-mail before `@` is used. If nothing usable is left, `Evaluator`.
- `<yyyy-mm-dd>`: the export date, local day.
- `<N>` and `<T>`: part number and total parts, when the export is split.

Each ZIP contains:

```
data.json          machine-readable export (section 3); the source of truth
gallery.json       captioned photos and videos in this ZIP, for a carousel (section 8)
summary.md         human-readable summary (section 5)
summary.xlsx       the same content as three sheets (section 6)
README.txt         short description of the ZIP contents (CRLF line endings)
media/<NN>_<evaluation>/...   photos, videos and voice notes (section 4)
```

Sizes: the app keeps every ZIP under 100 MiB (`ZIP_LIMIT`). It reserves 2 MiB per part for the documents. Items that are bigger than the capacity get a part of their own.

The ZIP is the only export. It is sent to WhatsApp as a document, so photos keep their original quality.

## 2. Key concepts

- **Evaluation**: one truck or one component. Evaluations are sorted oldest first (`createdAt`) and numbered `no` = 1, 2, 3, ... in the export.
- **Feature**: one of the truck questionnaire features (`FEATURES` in `src/config/questionnaire.ts`, currently 13). Each has an `id` such as `seats`, `bed` or `cab-space`, and a `title`.
- **Score**: integer 0 to 5 for a feature (`Score` type). The scale labels are 0 "Very poor / not present" and 5 "Excellent" (`SCALE`).
- **Score 0 versus null**:
  - `0` is a real score: the feature is very poor or not present.
  - `null` means the feature was not scored. In `summary.md` it shows `-`. In the Excel sheet the cell is empty. In `data.json` the value is `null`.
  - Never treat `null` as `0` when computing averages. Exclude it.
- **Draft versus finalized**: `status` is `draft` or `finalized`. Drafts can be in the export. Check `status` before you use the evaluation in a report.

## 3. `data.json`

Top level, UTF-8, pretty-printed:

| Field                | Type                       | Meaning |
| -------------------- | -------------------------- | ------- |
| `schema`             | string                     | Always `"fenatran-benchmark"`. |
| `schemaVersion`      | number                     | `2` for this version of the schema (`1` was the first release). |
| `questionnaireVersion` | string                   | Value of `QUESTIONNAIRE_VERSION`, currently `"2026.1"`. |
| `exportId`           | string                     | Same for all parts of one export. |
| `exportedAt`         | string (ISO 8601 UTC)      | Time of the export. |
| `part`               | number                     | Part number of this ZIP, starting at 1. |
| `totalParts`         | number                     | Total number of parts. `1` when not split. |
| `photoQuality`       | `"original"`             | Always `"original"`: photos are exported as stored on the device. |
| `videosIncluded`     | boolean                    | `false` when the user chose "Export without videos". |
| `questionnaire`      | object                     | `scale` (`{min: 0, max: 5, labels: {"0": "...", "5": "..."}}`) and `features` (array of `{id, title}`). |
| `evaluator`          | object                     | The profile (section 3.1). |
| `evaluations`        | array                      | All evaluations in the export, oldest first (section 3.2). |

### 3.1 `evaluator`

| Field   | Type   | Meaning |
| ------- | ------ | ------- |
| `name`  | string | Optional; empty string when not given. |
| `email` | string | Lowercase e-mail. Use it to look up the person in a directory. |

### 3.2 `evaluations[]`

Every evaluation has these fields, plus the three added by the export:

| Field           | Type                          | Meaning |
| --------------- | ----------------------------- | ------- |
| `id`            | string                        | Stable identifier of the evaluation. |
| `kind`          | `"truck"` or `"component"`    | Type of evaluation. |
| `status`        | `"draft"` or `"finalized"`    | Status when exported. |
| `createdAt`     | string (ISO 8601)             | |
| `updatedAt`     | string (ISO 8601)             | |
| `finalizedAt`   | string or absent              | Present when finalized. |
| `truck`         | object or absent              | Present for `kind: "truck"` (below). |
| `component`     | object or absent              | Present for `kind: "component"` (below). |
| `no`            | number                        | Number of the evaluation in this export, 1-based. |
| `title`         | string                        | Display title: brand label and model for trucks (for example `Scania R 450`), the component name for components. Falls back to `Untitled truck` or `Untitled component`. |
| `media`         | array of MediaEntry           | Every media item of the evaluation, including those not in this part (section 4). |

`truck` object:

| Field           | Type                                   | Meaning |
| --------------- | -------------------------------------- | ------- |
| `brand`         | string                                 | Brand from the list, or `"Other"`. |
| `brandOther`    | string or absent                       | Free text when `brand` is `"Other"`. |
| `model`         | string                                 | |
| `brochureMediaIds` | string[]                            | Ids of the brochure photos in `media`. |
| `features`      | object keyed by feature id             | One `FeatureAnswer` per feature the user opened. Features never opened may be missing. |

`FeatureAnswer` (values of `features`):

| Field      | Type              | Meaning |
| ---------- | ----------------- | ------- |
| `score`    | `0`-`5` or `null` | Section 2: `null` = not scored. |
| `comment`  | string            | Empty string when none. |
| `mediaIds` | string[]          | Ids of the media attached to this feature. |

Look up features by key: `truck.features["seats"].score`. Use `questionnaire.features` for the title and order.

`component` object:

| Field         | Type      | Meaning |
| ------------- | --------- | ------- |
| `name`        | string    | Component name. |
| `manufacturer` | string   | |
| `mediaIds`    | string[]  | Ids of the component media. |
| `comments`    | string    | |

### 3.3 MediaEntry (inside `evaluations[].media`)

| Field            | Type                                  | Meaning |
| ---------------- | ------------------------------------- | ------- |
| `id`             | string                                | Stable media id. Matches the ids in `mediaIds` and `brochureMediaIds`. |
| `file`           | string or `null`                      | Path inside **this** ZIP, for example `media/01_Scania_R/feature_seats_01.jpg`. `null` when the file is not in this ZIP. |
| `part`           | number or `null`                      | Part number that holds the file. `null` when the file is not in any part (videos excluded). |
| `type`           | `"photo"`, `"video"` or `"audio"`     | `audio` is a voice note. |
| `role`           | `"brochure"`, `"feature"` or `"component"` | Where the media belongs. |
| `featureId`      | string or `null`                      | Feature id when `role` is `"feature"`. |
| `caption`        | string                                | The observation text. Empty string when none. |
| `mime`           | string                                | **Original** MIME type captured on the device. See the warning below. |
| `durationSec`    | number or `null`                      | Duration in seconds for video and audio. |
| `annotatedFromId` | string or `null`                     | Id of the original photo when this item is a mark-up copy. |
| `createdAt`      | string (ISO 8601)                     | |

**Warning on `mime` and `file`**: HEIC/HEIF photos are converted to JPEG on export when the browser can decode them, but `mime` keeps the original value (for example `image/heic`). Use the extension of `file` to know the real format, not `mime`. If the conversion failed, the original file and MIME type are kept.

## 4. Media files and paths

### 4.1 Path rules

```
media/<NN>_<evaluation-slug>/<prefix>_<NN>[_<caption-slug>].<ext>
```

- `<NN>`: two-digit evaluation number (`01`, `02`, ...).
- `<evaluation-slug>`: slug of the evaluation title (for truck: brand and model; for component: name). Falls back to `truck` or `component`.
- `<prefix>`:
  - `feature_<featureId>` for feature media (or `feature_general` when no feature id is set).
  - `brochure` or `component` for the other roles.
- `<NN>` after the prefix: counter per prefix within the evaluation, starting at `01`.
- `<caption-slug>`: slug of the caption, only when the caption is not empty.
- `<ext>`: from the exported MIME type. Known types: `jpg`, `png`, `webp`, `gif`, `heic`, `heif`, `mp4`, `mov`, `webm`, `3gp`, `m4a`, `aac`, `mp3`, `ogg`, `wav`. Unknown types use `bin`.

Example: `media/01_Scania_R_450/feature_seats_02_driver-seat-adjustment.jpg`.

Slugs are ASCII and lowercase. Do not parse the caption from the file name. Read `caption` from `data.json`.

### 4.2 Videos and split exports

- Every part's `data.json` lists **all** evaluations and **all** media. Only the entries in that part have `file` and `part` set. Entries in other parts have `file: null` and `part` = the other part's number, so you can tell where the file is.
- Videos left out by "Export without videos" have `file: null` and `part: null` in every part.
- To find a file in a split export, read the `part` value of its MediaEntry, then open the ZIP named `..._part<part>of<totalParts>.zip`.

### 4.3 Photo and voice-note formats

- Photos: original bytes for JPEG, PNG, WebP and GIF (already at most 4096 px from capture). Other formats (HEIC/HEIF) are converted to JPEG (quality 0.92) when the browser can decode them.
- Videos: original bytes (`mp4`, `mov`, `webm` or `3gp`), not re-encoded.
- Voice notes: original bytes (`m4a`, `webm`, `ogg`, `wav`, `mp3`, `aac`, depending on the device).

Images are stored in the ZIP without compression. Text files are compressed.

## 5. `summary.md`

Generated in Markdown. It contains:

- Header: export date, part number, number of photos and videos, photo quality (`original`), the evaluator (`name (e-mail)`, or the e-mail alone) and the number of evaluations.
- One section per evaluation, headed `## <no>. <Truck|Component>: <title>`, with a `### Media (<count>)` list under it.
- For trucks: a table with the columns `# | Feature | Score | Comment | Media`. The score is the number, or `-` when not scored.
- Media lines in this form: `- <type>[, m:ss]: <file or "(not included in this export)">[ (part N)][ - caption]`.

Use `data.json` as the source. Use `summary.md` only for a quick read.

## 6. `summary.xlsx`

Three sheets. The first row of each sheet is a header with a frozen top row.

**Evaluations** (15 columns): `No`, `Kind`, `Status`, `Title`, `Brand`, `Model`, `Features scored`, `Component`, `Manufacturer`, `Comments`, `Media`, `Created`, `Updated`, `Finalized`, `Id`.

**Feature scores** (8 columns, trucks only): `No`, `Evaluation`, `Feature no`, `Feature id`, `Feature`, `Score`, `Comment`, `Media`. One row for every feature of every truck, in questionnaire order. `Score` and `Comment` are empty when not set. `Media` is the number of media items for that feature, not a list of files.

**Media** (10 columns): `No`, `Evaluation`, `Type`, `Role`, `Feature`, `Caption`, `File`, `Part`, `Duration (s)`, `Id`. `File` is empty when the file is not in this ZIP.

Each sheet has a sticky header row.

## 7. `README.txt`

Plain text, CRLF line endings. Describes the ZIP contents: `data.json`, `gallery.json`, `summary.md`, `summary.xlsx` (with its three sheets) and the `media/` folder.

## 8. `gallery.json`

A flat list of the captioned photos and videos stored in **this** ZIP part, ready for a photo carousel or a gallery import. It is built from the same data as `data.json`.

Rules:

- One item per photo or video whose caption is not empty (after trimming). Voice notes are never included.
- Only media whose file is in this part. In a split export each part has its own `gallery.json`.
- Videos left out by "Export without videos" are not listed.

Top level:

| Field            | Type                 | Meaning |
| ---------------- | -------------------- | ------- |
| `schema`         | string               | Always `"fenatran-gallery"`. |
| `schemaVersion`  | number               | `1`. |
| `exportId`       | string               | Same as in `data.json`. |
| `exportedAt`     | string (ISO 8601 UTC) | |
| `part`           | number               | Part number of this ZIP. |
| `totalParts`     | number               | |
| `evaluatorEmail` | string               | Use it to look up the person's display name and job title in a directory. |
| `evaluatorName`  | string               | As typed in the app; may be empty. Use as fallback. |
| `items`          | array                | See below. |

`items[]`:

| Field           | Type                       | Meaning |
| --------------- | -------------------------- | ------- |
| `mediaId`       | string                     | Same id as in `data.json`. |
| `file`          | string                     | Path inside this ZIP (`media/...`). |
| `type`          | `"photo"` or `"video"`     | |
| `caption`       | string                     | Trimmed caption. Never empty. |
| `evaluationNo`  | number                     | `no` of the evaluation in `data.json`. |
| `evaluationId`  | string                     | |
| `kind`          | `"truck"` or `"component"` | |
| `title`         | string                     | Evaluation title, as in `data.json`. |
| `brand`         | string or `null`           | Truck brand label (free text for "Other"). `null` for components or when empty. |
| `model`         | string or `null`           | Truck model. `null` for components or when empty. |
| `featureId`     | string or `null`           | Feature id for feature media. |
| `featureTitle`  | string or `null`           | Feature title from the questionnaire. |
| `componentName` | string or `null`           | Component name. `null` for trucks. |
| `manufacturer`  | string or `null`           | Component manufacturer. `null` for trucks. |
| `createdAt`     | string (ISO 8601)          | When the media was captured. |

Example item:

```json
{
  "mediaId": "6b1f...",
  "file": "media/01_Scania_R_450/feature_seats_01_driver-seat-adjustment.jpg",
  "type": "photo",
  "caption": "Driver seat adjustment",
  "evaluationNo": 1,
  "evaluationId": "0c9e...",
  "kind": "truck",
  "title": "Scania R 450",
  "brand": "Scania",
  "model": "R 450",
  "featureId": "seats",
  "featureTitle": "Driver and passenger seats",
  "componentName": null,
  "manufacturer": null,
  "createdAt": "2026-10-19T10:30:00.000Z"
}
```

To avoid duplicates when the same ZIP is imported twice, use `exportId` + `mediaId` as the key.
## 9. Checklist for a report builder

1. Read `data.json` first. Check `schemaVersion` is `2` (`1` had extra evaluator fields and a `reduced` photo quality).
2. Use `questionnaire.features` for the feature titles and order. Do not hard-code the feature list.
3. Treat `score: null` as "not scored". Do not average it as 0.
4. Use `file` and `part` to find media. Skip entries with `file: null`.
5. Use the extension of `file` for the real format. Do not trust `mime` for converted HEIC photos.
6. Use `caption` for the observation text, not the file name.
7. Use `status` to tell drafts from finalized evaluations.
8. For split exports, read every part's `data.json` for the full list of evaluations. Each part repeats the full list; use `exportId` to group the parts.
