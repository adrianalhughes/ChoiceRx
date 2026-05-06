# Responsible Steps Database Logic

## Source of Truth

- Source document: Florida Blue Responsible Steps PDF (`Rx_ResponsibleSteps.pdf`).
- Canonical app data: `src/data/step_therapy.json`.
- Rule: Step Therapy display is driven by **target drug presence** in `step_therapy.json`, not formulary `st` flags.

## Data Model (DB)

```sql
create table responsible_steps_program (
  id bigserial primary key,
  source_name text not null,                 -- e.g. 'FL Blue Responsible Steps'
  source_url text not null,
  source_version text not null,              -- e.g. '2026-04-01'
  imported_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table responsible_steps_target_drug (
  id bigserial primary key,
  program_id bigint not null references responsible_steps_program(id),
  target_drug text not null,                 -- exact display target from document
  target_drug_normalized text not null,      -- normalized lookup key
  category text,                             -- optional therapeutic category
  unique(program_id, target_drug_normalized)
);

create table responsible_steps_prerequisite (
  id bigserial primary key,
  target_drug_id bigint not null references responsible_steps_target_drug(id),
  prerequisite_text text not null,           -- exact prerequisite sentence/paragraph
  sort_order int not null default 1
);

create index idx_responsible_steps_target_normalized
  on responsible_steps_target_drug(target_drug_normalized);
```

## Normalization and Matching Logic

- Normalize search and stored keys using:
  - lowercase
  - split alphanumeric boundaries (`450mg` -> `450 mg`)
  - remove non-alphanumerics to spaces
  - collapse repeated spaces
- Lookup order:
  1. exact normalized key match
  2. normalized containment fallback for close descriptor variants
- Parenthetical aliases are intentionally ignored for matching to reduce false positives.

Pseudo:

```ts
normalize(s):
  s = s.toLowerCase()
  s = s.replace(/([a-z])(\\d)/g, '$1 $2')
  s = s.replace(/(\\d)([a-z])/g, '$1 $2')
  s = s.replace(/[^a-z0-9]+/g, ' ').trim()
  return s

lookup(term):
  n = normalize(term)
  if exists target_drug_normalized == n: return prerequisites
  if exists where n contains target_drug_normalized
     or target_drug_normalized contains n: return prerequisites
  return null
```

## UI Rules

- If formulary search returns rows, show them.
- For each row, if lookup(row.drug_name) returns prerequisites, render:
  - `Step Therapy Required`
  - `Must try first` + prerequisite text.
- Independently, show `Responsible Steps Matches` section for direct target-drug hits from `step_therapy.json`, even if not on formulary.
- If no formulary match and no Responsible Steps match, show fallback link to full criteria PDF.

## Parity QA Checklist

- Every “Drugs Included in Program (Target Drug)” entry exists as a key in `step_therapy.json`.
- Each key has prerequisite text copied exactly from PDF section context.
- Spot-check high-risk names:
  - brand + strength variants (e.g., `BUPROPION 450 MG XL`)
  - dosage-form qualifiers (`capsule`, `oral suspension`, `ODT`, `ER`)
  - punctuation variants.
