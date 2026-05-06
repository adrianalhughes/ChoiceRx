#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from responsible_steps_tools import (
    PDF_URL,
    best_key_match,
    clean_cell,
    download_pdf,
    normalize_text,
    parse_pdf_targets,
)


def normalize_prereq(items):
    if not items:
        return ""
    return normalize_text(" ".join(clean_cell(i) for i in items))


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit step_therapy.json against Responsible Steps PDF.")
    parser.add_argument("--pdf-path", default="tmp/Rx_ResponsibleSteps.pdf")
    parser.add_argument("--json-path", default="src/data/step_therapy.json")
    parser.add_argument("--report", default="docs/responsible-steps-parity-report.md")
    parser.add_argument("--download", action="store_true", help="Download latest PDF before auditing.")
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    json_path = Path(args.json_path)
    report_path = Path(args.report)

    if args.download or not pdf_path.exists():
        download_pdf(pdf_path)

    parsed = parse_pdf_targets(pdf_path)
    current = json.loads(json_path.read_text())

    parsed_keys = sorted(parsed.keys())
    current_keys = sorted(current.keys())

    missing_in_json = []
    matched_parsed_keys = set()
    for pk in parsed_keys:
        mk, mtype = best_key_match(pk, current_keys)
        if mtype == "none":
            missing_in_json.append(pk)
            continue
        matched_parsed_keys.add(mk)

    extra_in_json = [k for k in current_keys if k not in matched_parsed_keys]

    prerequisite_mismatches = []
    for pk in parsed_keys:
        mk, mtype = best_key_match(pk, current_keys)
        if mtype == "none":
            continue
        p_norm = normalize_prereq(parsed.get(pk, []))
        c_norm = normalize_prereq(current.get(mk, []))
        if p_norm and c_norm and p_norm != c_norm:
            prerequisite_mismatches.append((pk, mk))

    report_lines = [
        "# Responsible Steps Parity Report",
        "",
        f"- Source PDF: [{PDF_URL}]({PDF_URL})",
        f"- Parsed target entries from PDF: **{len(parsed_keys)}**",
        f"- Entries in `step_therapy.json`: **{len(current_keys)}**",
        "",
        "## Summary",
        f"- Missing target drugs in JSON: **{len(missing_in_json)}**",
        f"- Extra JSON keys not matched from parsed PDF: **{len(extra_in_json)}**",
        f"- Prerequisite text mismatches (normalized): **{len(prerequisite_mismatches)}**",
        "",
    ]

    if missing_in_json:
        report_lines.extend(["## Missing Targets", ""])
        report_lines.extend([f"- `{item}`" for item in missing_in_json[:200]])
        report_lines.append("")

    if extra_in_json:
        report_lines.extend(["## Extra JSON Keys", ""])
        report_lines.extend([f"- `{item}`" for item in extra_in_json[:200]])
        report_lines.append("")

    if prerequisite_mismatches:
        report_lines.extend(["## Prerequisite Mismatches", ""])
        for pk, mk in prerequisite_mismatches[:200]:
            report_lines.append(f"- PDF `{pk}` <> JSON `{mk}`")
        report_lines.append("")

    report_lines.extend([
        "## Notes",
        "",
        "- This parser is heuristic because PDF table extraction is not perfectly structured.",
        "- Treat this report as an exceptions list for rapid human review, not as an autonomous overwrite signal.",
        "",
    ])

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(report_lines) + "\n")

    print(f"Wrote report: {report_path}")
    print(f"Missing: {len(missing_in_json)} | Extra: {len(extra_in_json)} | Mismatches: {len(prerequisite_mismatches)}")


if __name__ == "__main__":
    main()
