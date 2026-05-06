import re
from pathlib import Path
from typing import Dict, List, Tuple

import pdfplumber
import requests


PDF_URL = "https://www.bcbsfl.com/DocumentLibrary/Providers/Content/Rx_ResponsibleSteps.pdf"


def normalize_text(value: str) -> str:
    value = value or ""
    value = value.lower()
    value = re.sub(r"([a-z])(\d)", r"\1 \2", value)
    value = re.sub(r"(\d)([a-z])", r"\1 \2", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def clean_cell(value: str) -> str:
    value = (value or "").replace("\n", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value.strip(" ,;")


def download_pdf(pdf_path: Path) -> None:
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    response = requests.get(PDF_URL, timeout=60)
    response.raise_for_status()
    pdf_path.write_bytes(response.content)


def _split_targets(target_text: str) -> List[str]:
    text = clean_cell(target_text)
    if not text:
        return []
    return [part.strip() for part in re.split(r",\s*", text) if part.strip()]


def parse_pdf_targets(pdf_path: Path) -> Dict[str, List[str]]:
    """
    Heuristic parse of Responsible Steps table rows.
    Returns: {TARGET_DRUG_UPPER: [prerequisite_text]}
    """
    mapping: Dict[str, List[str]] = {}
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                last_target = ""
                last_prereq = ""
                for row in table:
                    cells = [clean_cell(c) for c in row]
                    if not any(cells):
                        continue
                    row_text = " ".join(cells).lower()
                    if (
                        "therapeutic category" in row_text
                        or "drugs included in program" in row_text
                        or "prerequisite drugs" in row_text
                        or "responsible steps program information" in row_text
                        or "florida blue is an independent licensee" in row_text
                        or "check member benefit documentation" in row_text
                    ):
                        continue

                    target = ""
                    prereq = ""
                    if len(cells) >= 4:
                        target, prereq = cells[2], cells[3]
                    elif len(cells) == 3:
                        target, prereq = cells[1], cells[2]
                    elif len(cells) == 2:
                        target, prereq = cells[0], cells[1]
                    else:
                        target = cells[0]

                    if target and prereq:
                        last_target = target
                        last_prereq = prereq
                    elif target and not prereq:
                        last_target = f"{last_target} {target}".strip() if last_target else target
                        continue
                    elif prereq and not target:
                        last_prereq = f"{last_prereq} {prereq}".strip() if last_prereq else prereq
                        if not last_target:
                            continue
                    else:
                        continue

                    if not last_target or not last_prereq:
                        continue

                    for target_part in _split_targets(last_target):
                        key = target_part.upper()
                        mapping[key] = [clean_cell(last_prereq)]
    return mapping


def best_key_match(parsed_key: str, json_keys: List[str]) -> Tuple[str, str]:
    """
    Returns (matched_key, match_type) where match_type in {exact, contains, none}.
    """
    if parsed_key in json_keys:
        return parsed_key, "exact"
    np = normalize_text(parsed_key)
    for key in json_keys:
        nk = normalize_text(key)
        if np and (np in nk or nk in np):
            return key, "contains"
    return "", "none"
