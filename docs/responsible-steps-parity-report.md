# Responsible Steps Parity Report

- Source PDF: [https://www.bcbsfl.com/DocumentLibrary/Providers/Content/Rx_ResponsibleSteps.pdf](https://www.bcbsfl.com/DocumentLibrary/Providers/Content/Rx_ResponsibleSteps.pdf)
- Parsed target entries from PDF: **99**
- Entries in `step_therapy.json`: **131**

## Summary
- Missing target drugs in JSON: **0**
- Extra JSON keys not matched from parsed PDF: **33**
- Prerequisite text mismatches (normalized): **0**

## Extra JSON Keys

- `APLENZIN`
- `BUPROPION 450 MG XL`
- `CELEXA`
- `CITALOPRAM 30 MG CAPSULE`
- `CYMBALTA`
- `DESVENLAFAXINE ER`
- `EFFEXOR XR`
- `ESCITALOPRAM 15 MG CAPSULE`
- `EXXUA`
- `FETZIMA`
- `FLUOXETINE 60 MG`
- `FLUOXETINE 90 MG WEEKLY`
- `FORFIVO XL`
- `FREESTYLE LIBRE 2`
- `FREESTYLE LIBRE 3 SYSTEMS (READER`
- `G7 SYSTEMS (RECEIVER`
- `LEXAPRO`
- `PAROXETINE ORAL SUSPENSION`
- `PAXIL`
- `PAXIL CR`
- `PREGABALIN ER`
- `PRISTIQ`
- `PROZAC`
- `REMERON`
- `REMERON SOLTAB`
- `SENSOR)`
- `SERTRALINE CAPSULES`
- `TRINTELLIX`
- `VENLAFAXINE ER 112.5 MG TABLET`
- `VIIBRYD`
- `WELLBUTRIN SR`
- `WELLBUTRIN XL`
- `ZOLOFT`

## Notes

- This parser is heuristic because PDF table extraction is not perfectly structured.
- Treat this report as an exceptions list for rapid human review, not as an autonomous overwrite signal.

