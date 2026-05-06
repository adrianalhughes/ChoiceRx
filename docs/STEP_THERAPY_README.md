# Step Therapy Feature README

## Overview

The Step Therapy feature surfaces Florida Blue Responsible Steps criteria inline in the formulary search experience.

### What it does

- Maps a searched medication to Responsible Steps target drugs from FL Blue.
- Displays prerequisite drug requirements directly in the UI under `Step Therapy Required`.
- Shows a dedicated `Responsible Steps Matches` section for target drugs that may not appear as active formulary rows.

### Why it exists (clinical problem)

Clinicians and pharmacy teams need to know, at point-of-search, whether a medication requires prior step therapy and exactly which first-line drugs must be tried first. Without this, staff must manually open and interpret PDF policy documents, increasing delays and error risk in medication access workflows.

This feature reduces that friction by embedding policy criteria in the same place users review formulary coverage.

---

## Data Pipeline

Source document:
- [FL Blue Responsible Steps PDF](https://www.bcbsfl.com/DocumentLibrary/Providers/Content/Rx_ResponsibleSteps.pdf)

Data flow:

1. **Download latest PDF**
   - Pulled by the script pipeline into local temp path (default `tmp/Rx_ResponsibleSteps.pdf`).

2. **Parse PDF tables**
   - `scripts/responsible_steps_tools.py` uses `pdfplumber` to read table rows.
   - Extracts:
     - target drug strings (from “Drugs Included in Program (Target Drug)”)
     - prerequisite text (from “Prerequisite Drugs”)

3. **Generate parsed draft**
   - `scripts/build_responsible_steps.py` writes parsed output to:
     - `src/data/step_therapy.generated.json`
   - This is a parser-derived draft, not automatically production-approved data.

4. **Maintain canonical dataset**
   - Production app uses:
     - `src/data/step_therapy.json`
   - This file can include parser output plus normalization/alias coverage entries.

5. **Audit canonical vs parsed output**
   - `scripts/audit_responsible_steps.py` compares parsed PDF targets vs canonical JSON and writes:
     - `docs/responsible-steps-parity-report.md`
   - Report includes:
     - missing targets
     - extra keys
     - prerequisite text mismatches

6. **UI consumption**
   - `src/App.jsx` imports `step_therapy.json`.
   - Search results and row-level cards use this file to render prerequisites inline.

---

## Scripts

## `scripts/responsible_steps_tools.py`

Shared utilities used by build/audit scripts.

Core responsibilities:
- Download PDF (`download_pdf`)
- Normalize strings (`normalize_text`, `clean_cell`)
- Parse PDF table rows into `{TARGET_DRUG: [prerequisite_text]}` (`parse_pdf_targets`)
- Match keys between parsed and canonical datasets (`best_key_match`)

Inputs:
- PDF path (local file)

Outputs:
- In-memory parsed mapping for downstream scripts

When to run:
- Indirectly via build/audit scripts.

---

## `scripts/build_responsible_steps.py`

Builds a parser-derived JSON draft from the Responsible Steps PDF.

Default command:

```bash
python3 scripts/build_responsible_steps.py --download
```

Inputs:
- `--pdf-path` (default `tmp/Rx_ResponsibleSteps.pdf`)
- `--download` optional flag to fetch latest PDF

Outputs:
- `src/data/step_therapy.generated.json`

When to run:
- After FL Blue publishes updates
- Before reconciliation into canonical `step_therapy.json`

---

## `scripts/audit_responsible_steps.py`

Audits canonical `step_therapy.json` against parsed PDF output.

Default command:

```bash
python3 scripts/audit_responsible_steps.py --download
```

Inputs:
- `--pdf-path` (default `tmp/Rx_ResponsibleSteps.pdf`)
- `--json-path` (default `src/data/step_therapy.json`)
- `--report` (default `docs/responsible-steps-parity-report.md`)

Outputs:
- `docs/responsible-steps-parity-report.md`
- Console summary: Missing / Extra / Mismatches

When to run:
- Every policy refresh
- Before release when step therapy logic/data changed

---

## Data Structure

Canonical file:
- `src/data/step_therapy.json`

Shape:

```json
{
  "TARGET DRUG KEY": [
    "Prerequisite text from Responsible Steps"
  ]
}
```

Key semantics:
- Keys represent Responsible Steps **target drugs** (or intentional aliases used for matching/coverage).
- Values are arrays to support multi-line prerequisite criteria.

Matching normalization:
- Lowercasing
- Alphanumeric splitting (`450mg` -> `450 mg`)
- Non-alphanumeric collapse to spaces

### About the “33 extra keys”

In parity reports, “extra keys” are keys in `step_therapy.json` not matched by the parser’s extracted target list. These usually exist for one of these reasons:

- parser misses/splits some PDF targets due to table extraction artifacts
- intentional aliases added to improve search reliability for real user input
- normalization support for variant naming/strength formatting

`extra` is not automatically an error; classify each as either intentional alias coverage or remove if redundant/wrong.

---

## UI Logic

Main implementation:
- `src/App.jsx`

### Row-level display

For each displayed formulary row:
- app resolves step therapy via `lookupStepTherapyForDrug(drug.name)`
- if criteria is found, renders:
  - `Step Therapy Required`
  - `Must try first` list inline

Important rule:
- Parenthetical text in formulary drug names is treated as reference context and is stripped for matching.

### Search-level Responsible Steps section

For the current search term:
- `findResponsibleStepsMatches(query)` finds matching target keys in `step_therapy.json`
- renders `Responsible Steps Matches` cards, including drugs not shown as formulary rows

### Fallback behavior

If no formulary matches and no Responsible Steps matches:
- UI shows fallback with link to full Responsible Steps PDF.

### Relationship to formulary `st` flag

- Formulary `st` is **not** the source of truth for criteria content.
- Responsible Steps criteria display is driven by `step_therapy.json` lookup logic.
- `st` may still appear as a badge in formulary criteria chips where present.

---

## Maintenance

Recommended update flow when FL Blue publishes a new PDF:

1. Build parser draft:
   ```bash
   npm run responsible-steps:build
   ```
2. Run audit:
   ```bash
   npm run responsible-steps:audit
   ```
3. Review `docs/responsible-steps-parity-report.md`
4. Reconcile canonical `src/data/step_therapy.json`:
   - add missing target keys
   - correct mismatched prerequisite text
   - keep/remove extras based on intentional alias policy
5. Re-run audit until acceptable status:
   - Missing = 0
   - Mismatches = 0
   - Extras understood and documented
6. Validate in UI with known probes (e.g., Aplenzin, Bupropion 450 mg XL, Celexa, Cymbalta, Lexapro, Farxiga)

How to interpret audit summary:
- **Missing > 0**: parser found targets not represented in canonical JSON; add/repair keys.
- **Mismatches > 0**: prerequisite text differs; review and correct canonical values.
- **Extra > 0**: classify as intentional alias coverage vs stale/unwanted keys.

---

## Known Limitations

- PDF table extraction is heuristic; multi-line/split cells can fragment target names.
- Parser output is a draft, not guaranteed publication-ready without review.
- “Extra key” counts can include valid alias/support keys by design.
- Matching currently relies on normalization and controlled containment fallback; ambiguous names can still require manual key tuning.
- There is no strict CI gate currently enforcing zero-missing/zero-mismatch (by request). Audits are manual-run quality checks.

---

## Quick Commands

From repo root (`/Users/kitty/ChoiceRx`):

```bash
npm run responsible-steps:build
npm run responsible-steps:audit
```

Primary outputs:
- `src/data/step_therapy.generated.json`
- `docs/responsible-steps-parity-report.md`
