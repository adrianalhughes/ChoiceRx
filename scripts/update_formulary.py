#!/usr/bin/env python3
"""
Sanitas Formulary Auto-Updater
Runs monthly via GitHub Actions to refresh all four plan formularies.
"""

import pdfplumber, re, json, requests, hashlib, sys, os
from datetime import datetime, date
from collections import defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "src" / "data"

# ── Florida Blue — stable URLs ────────────────────────────────────────────────
FL_PLANS = [
    {
        "id": "bcbsfl",
        "url": "https://www.bcbsfl.com/DocumentLibrary/Providers/Content/ValueScriptRxMedGuide.pdf",
        "out": "bcbsfl.json",
        "tiers": 6,
        "parser": "fl_6tier",
    },
    {
        "id": "simplechoice",
        "url": "https://www.bcbsfl.com/DocumentLibrary/Providers/Content/ValueScriptSimpleChoiceMedGuide.pdf",
        "out": "simplechoice.json",
        "tiers": 6,
        "parser": "fl_6tier",
    },
]

# ── UHC — construct URL from current month, fall back to previous ─────────────
MONTH_NAMES = ["january","february","march","april","may","june",
               "july","august","september","october","november","december"]

def uhc_pdf_url(plan_type, year, month_idx):
    month = MONTH_NAMES[month_idx - 1]
    if plan_type == "advantage":
        return f"https://www.uhc.com/content/dam/uhcdotcom/en/Pharmacy/PDFs/pharmacy-pdl-texas-advantage-3t-{month}-{year}.pdf"
    else:
        return f"https://www.uhc.com/content/dam/uhcdotcom/en/Pharmacy/PDFs/pharmacy-pdl-texas-essential-4t-{month}-{year}.pdf"

def find_latest_uhc_url(plan_type):
    """Try current month, fall back to previous two months."""
    today = date.today()
    for delta in [0, 1, 2]:
        month = today.month - delta
        year = today.year
        if month <= 0:
            month += 12
            year -= 1
        url = uhc_pdf_url(plan_type, year, month)
        try:
            r = requests.head(url, timeout=10, allow_redirects=True)
            if r.status_code == 200:
                print(f"  Found UHC {plan_type}: {url}")
                return url
        except Exception:
            pass
    return None

UHC_PLANS = [
    {"id": "uhc_texas",           "type": "advantage", "out": "uhc_texas.json",          "tiers": 3, "parser": "uhc_3tier"},
    {"id": "uhc_texas_essential", "type": "essential", "out": "uhc_texas_essential.json", "tiers": 4, "parser": "uhc_4tier"},
]

# ── Shared helpers ─────────────────────────────────────────────────────────────
def pdf_hash(path):
    return hashlib.md5(open(path, "rb").read()).hexdigest()

def download_pdf(url, dest):
    headers = {"User-Agent": "Mozilla/5.0 (compatible; SanitasBot/1.0)"}
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    with open(dest, "wb") as f:
        f.write(r.content)
    print(f"  Downloaded {len(r.content)//1024}KB")

# ── Florida Blue 6-tier parser ─────────────────────────────────────────────────
def parse_fl_6tier(pdf_path):
    """Parse a Florida Blue 6-tier ValueScript formulary PDF."""
    drugs = []
    condition = None

    SKIP = ["drug name","tier","limits","requirements","&","pa:","ql:","st:","sp:","h:"]
    CONDITION_KEYWORDS = [
        "Analgesics","Antibacterials","Anticoagulants","Anticonvulsants","Antidementia",
        "Antidepressants","Antiemetics","Antifungals","Antigout","Antimigraine",
        "Antineoplastics","Antiparasitics","Antiparkinson","Antiplatelets","Antipsychotics",
        "Antivirals","Anxiolytics","Bipolar","Cardiovascular","Central Nervous","Dental",
        "Dermatological","Diabetes","Drugs for","Electrolytes","Gastrointestinal","Genetic",
        "Genitourinary","Hormonal","Immunological","Infertility","Inflammatory","Metabolic",
        "Ophthalmic","Otic","Respiratory","Skeletal","Sleep","Anti-Addiction",
    ]

    def is_condition(text):
        return any(text.strip().startswith(k) for k in CONDITION_KEYWORDS)

    def parse_req(r):
        u = r.upper()
        return {
            "pa": bool(re.search(r"\bPA\b", u)) and "H-PA" not in u,
            "st": bool(re.search(r"\bST\b", u)),
            "ql": bool(re.search(r"\bQL\b", u)),
            "sp": bool(re.search(r"\bSP\b", u)),
            "h":  bool(re.search(r"\bH\b",  u)),
            "h_pa": "H-PA" in u,
        }

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            rows = {}
            for w in words:
                y = round(w["top"] / 4) * 4
                if y not in rows: rows[y] = []
                rows[y].append(w)
            for y in sorted(rows):
                rw = sorted(rows[y], key=lambda w: w["x0"])
                texts = [w["text"].lower() for w in rw]
                if any(t in SKIP for t in texts): continue
                full = " ".join(w["text"] for w in rw).strip()
                if not full: continue
                # Two-column: split at midpoint
                pw = page.width
                for col_words in [
                    [w for w in rw if w["x0"] < pw * 0.5],
                    [w for w in rw if w["x0"] >= pw * 0.5],
                ]:
                    if not col_words: continue
                    name_ws = [w for w in col_words if w["x0"] < (pw * 0.35 if col_words[0]["x0"] < pw * 0.5 else pw * 0.85)]
                    tier_ws = [w for w in col_words if w not in name_ws]
                    name_t = " ".join(w["text"] for w in name_ws).strip()
                    rest_t = " ".join(w["text"] for w in tier_ws).strip()
                    if not name_t: continue
                    if is_condition(name_t):
                        condition = name_t
                        continue
                    tier_match = re.search(r"\b([1-6])\b", rest_t)
                    if not tier_match: continue
                    tier = int(tier_match.group(1))
                    r = parse_req(rest_t)
                    has_r = r["pa"] or r["ql"] or r["st"] or r["sp"] or r["h_pa"]
                    entry = {"name": name_t.strip(), "tier": tier}
                    if has_r:
                        entry.update({"pa": r["pa"] or r["h_pa"], "st": r["st"], "ql": r["ql"], "h": r["h"], "sp": r["sp"], "ql_detail": ""})
                    drugs.append({"condition": condition, "has_restriction": has_r, **entry})

    # Group by condition
    cond_map = defaultdict(lambda: {"clean": [], "restricted": []})
    for d in drugs:
        cond = d["condition"] or "Other"
        e = {k: v for k, v in d.items() if k not in ("condition", "has_restriction")}
        if d["has_restriction"]:
            cond_map[cond]["restricted"].append(e)
        else:
            cond_map[cond]["clean"].append({"name": e["name"], "tier": e["tier"]})

    return [{"condition": c, "clean": sorted(v["clean"], key=lambda x: x["tier"]),
             "restricted": sorted(v["restricted"], key=lambda x: x["tier"])}
            for c, v in cond_map.items()]

# ── UHC parser (shared for 3-tier and 4-tier) ─────────────────────────────────
UHC_CATEGORIES = [
    "Analgesics - Drugs for Pain","Analgesics - Drugs for Pain and Inflammation",
    "Anti-Addiction / Substance Abuse Treatment Agents","Antibacterials - Drugs for Infections",
    "Anticoagulants - Drugs to Treat or Prevent Blood Clots","Anticonvulsants - Drugs for Seizures",
    "Antidementia Agents - Drugs for Alzheimer's Disease and Dementia","Antidepressants - Drugs for Depression",
    "Antiemetics - Drugs for Nausea and Vomiting","Antifungals - Drugs for Fungal Infections",
    "Antigout Agents - Drugs for Gout","Antimigraine Agents - Drugs for Migraines",
    "Antimyasthenic Agents - Drugs to Treat Myasthenia Gravis","Antimycobacterials - Drugs to Treat Infections",
    "Antineoplastics - Drugs for Cancer","Antiparasitics - Drugs for Parasitic Infections",
    "Antiparkinson Agents - Drugs for Parkinson's Disease","Antiplatelets - Drugs for Heart Attack and Stroke Prevention",
    "Antipsychotics - Drugs for Mood Disorders","Antivirals - Drugs for Viral Infections",
    "Anxiolytics - Drugs for Anxiety","Bipolar Agents - Drugs for Mood Disorders",
    "Cardiovascular Agents - Drugs for Heart and Circulation Conditions",
    "Central Nervous System Agents - Drugs for Attention Deficit Disorder",
    "Central Nervous System Agents - Drugs for Multiple Sclerosis","Central Nervous System Agents - Miscellaneous",
    "Dental and Oral Agents - Drugs for Mouth and Throat Conditions","Dermatological Agents - Drugs for Skin Conditions",
    "Diabetes - Glucose Monitoring and Supplies","Diabetes - Insulin","Diabetes - Non-Insulin Agents",
    "Drugs for Blood Disorders","Drugs for Sexual Dysfunction","Electrolytes / Vitamins",
    "Gastrointestinal Agents - Drugs for Acid Reflux and Ulcer",
    "Gastrointestinal Agents - Drugs for Bowel, Intestine and Stomach Conditions",
    "Genetic or Enzyme Disorder - Drugs for Replacement, Modification, Treatment",
    "Genitourinary Agents - Drugs for Bladder, Genital and Kidney Conditions",
    "Genitourinary Agents - Drugs for Prostate Conditions","Hormonal Agents - Hormone Replacement and Birth Control",
    "Hormonal Agents - Oral Steroids","Hormonal Agents - Other","Hormonal Agents - Testosterone Replacement",
    "Hormonal Agents - Thyroid","Immunological Agents - Drugs for Immune System Stimulation or Suppression",
    "Immunological Agents - Drugs for Vaccination","Infertility Agents","Inflammatory Bowel Disease Agents",
    "Metabolic Bone Disease Agents - Drugs for Osteoporosis","Metabolic Bone Disease Agents - Other",
    "Ophthalmic Agents - Drugs for Eye Allergy, Infection and Inflammation","Ophthalmic Agents - Drugs for Glaucoma",
    "Ophthalmic Agents - Drugs for Miscellaneous Eye Conditions","Otic Agents - Drugs for Ear Conditions",
    "Respiratory - Drugs for Anaphylaxis","Respiratory Tract / Pulmonary Agents - Drugs for Allergies, Cough, Cold",
    "Respiratory Tract / Pulmonary Agents - Drugs for Asthma and COPD",
    "Respiratory Tract / Pulmonary Agents - Drugs for Cystic Fibrosis",
    "Respiratory Tract / Pulmonary Agents - Drugs for Pulmonary Fibrosis",
    "Respiratory Tract / Pulmonary Agents - Drugs for Pulmonary Hypertension",
    "Skeletal Muscle Relaxants - Drugs for Muscle Pain and Spasm","Sleep Disorder Agents",
]

def match_uhc_cat(text):
    t = text.strip()
    if len(t) < 8: return None
    for cat in UHC_CATEGORIES:
        if cat == t: return cat
    for cat in UHC_CATEGORIES:
        if len(t) >= 10 and cat.startswith(t): return cat
    for cat in UHC_CATEGORIES:
        if len(cat) >= 10 and t.startswith(cat): return cat
    return None

UHC_TRIGGERS = [
    "Analgesics","Anti-Addiction","Antibacterials","Anticoagulants","Anticonvulsants",
    "Antidementia","Antidepressants","Antiemetics","Antifungals","Antigout","Antimigraine",
    "Antimyasthenic","Antimycobacterials","Antineoplastics","Antiparasitics","Antiparkinson",
    "Antiplatelets","Antipsychotics","Antivirals","Anxiolytics","Bipolar Agents",
    "Cardiovascular Agents","Central Nervous","Dental and Oral","Dermatological",
    "Drugs for Blood","Drugs for Sexual","Electrolytes","Gastrointestinal","Genetic or Enzyme",
    "Genitourinary","Hormonal Agents","Immunological","Infertility Agents","Inflammatory Bowel",
    "Metabolic Bone","Ophthalmic","Otic Agents","Respiratory","Skeletal Muscle","Sleep Disorder",
]

def find_uhc_cat(text):
    for trig in sorted(UHC_TRIGGERS, key=len, reverse=True):
        idx = text.find(trig)
        if idx >= 0:
            cat = match_uhc_cat(text[idx:].strip())
            if cat: return idx, cat
    return -1, None

def parse_uhc(pdf_path):
    reading_order = []
    with pdfplumber.open(pdf_path) as pdf:
        for pnum in range(8, 43):
            if pnum - 1 >= len(pdf.pages): break
            page = pdf.pages[pnum - 1]
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            rows = {}
            for w in words:
                y = round(w["top"] / 4) * 4
                if y not in rows: rows[y] = []
                rows[y].append(w)
            left_rows, right_rows = [], []
            for y in sorted(rows):
                rw = sorted(rows[y], key=lambda w: w["x0"])
                texts = [w["text"] for w in rw]
                if set(texts) & {"Drug","Name","Tier","Limits","Requirements","&"}: continue
                left  = [w for w in rw if w["x0"] < 290]
                right = [w for w in rw if w["x0"] >= 300]
                if left:  left_rows.append((y, left))
                if right: right_rows.append((y, right))
            if left_rows:  reading_order.append((False, left_rows))
            if right_rows: reading_order.append((True,  right_rows))

    all_drugs = []
    current_cond = [None]
    pending = [None]

    def flush():
        if pending[0]:
            p = pending[0]
            all_drugs.append({
                "condition": current_cond[0],
                "name": re.sub(r"\s+", " ", re.sub(r"^[gB]\s+", "", " ".join(p["name_parts"])).strip()),
                "tier": p["tier"], "req": p["req"],
            })
        pending[0] = None

    for (is_right, rows_list) in reading_order:
        nc  = 462 if is_right else 192
        tl  = 463 if is_right else 193
        th  = 506 if is_right else 225
        for (y, col_words) in rows_list:
            name_ws = [w for w in col_words if w["x0"] < nc]
            tier_ws = [w for w in col_words if tl <= w["x0"] <= th]
            req_ws  = [w for w in col_words if w["x0"] > th]
            name_t = " ".join(w["text"] for w in name_ws).strip()
            tier_t = " ".join(w["text"] for w in tier_ws).strip()
            req_t  = " ".join(w["text"] for w in req_ws).strip()
            full_t = " ".join(w["text"] for w in col_words).strip()
            first  = tier_t[0] if tier_t else ""
            if not first.isdigit():
                cat = match_uhc_cat(full_t) or match_uhc_cat(name_t)
                if cat:
                    flush()
                    current_cond[0] = cat
                    continue
                idx, cat = find_uhc_cat(full_t)
                if cat:
                    flush()
                    current_cond[0] = cat
                    continue
                if pending[0] and name_t and "See page" not in name_t:
                    pending[0]["name_parts"].append(name_t)
                continue
            flush()
            cat_idx, new_cat = find_uhc_cat(req_t)
            actual_req = req_t[:cat_idx].strip() if cat_idx >= 0 else req_t
            pending[0] = {"name_parts": [name_t], "tier": int(first), "req": actual_req}
            if new_cat:
                flush()
                current_cond[0] = new_cat

    flush()

    def parse_req(req_raw):
        r = req_raw.upper()
        return {
            "pa": bool(re.search(r"\bPA\b", r)) and "H-PA" not in r,
            "ql": bool(re.search(r"\bQL\b", r)),
            "st": bool(re.search(r"\bST\b", r)),
            "sp": bool(re.search(r"\bSP\b", r)),
            "h":  bool(re.search(r"\bH\b",  r)),
            "h_pa": "H-PA" in r,
        }

    cond_map = defaultdict(lambda: {"clean": [], "restricted": []})
    for e in all_drugs:
        cond = e["condition"] or "Other"
        r = parse_req(e["req"])
        has_r = r["pa"] or r["ql"] or r["st"] or r["sp"] or r["h_pa"]
        if has_r:
            cond_map[cond]["restricted"].append({
                "name": e["name"], "tier": e["tier"],
                "pa": r["pa"] or r["h_pa"], "st": r["st"],
                "ql": r["ql"], "h": r["h"] or r["h_pa"],
                "sp": r["sp"], "ql_detail": "",
            })
        else:
            cond_map[cond]["clean"].append({"name": e["name"], "tier": e["tier"]})

    output = []
    seen = set()
    for cat in UHC_CATEGORIES:
        if cat in cond_map:
            seen.add(cat)
            d = cond_map[cat]
            output.append({"condition": cat,
                           "clean": sorted(d["clean"], key=lambda x: x["tier"]),
                           "restricted": sorted(d["restricted"], key=lambda x: x["tier"])})
    for cat, d in cond_map.items():
        if cat not in seen and (d["clean"] or d["restricted"]):
            output.append({"condition": cat, "clean": d["clean"], "restricted": d["restricted"]})
    return output

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    updated = []
    tmp = Path("/tmp/sanitas_pdfs")
    tmp.mkdir(exist_ok=True)

    print("\n=== Florida Blue Plans ===")
    for plan in FL_PLANS:
        print(f"\n[{plan['id']}] {plan['url']}")
        pdf_path = tmp / f"{plan['id']}.pdf"
        try:
            download_pdf(plan["url"], pdf_path)
            print("  Parsing...")
            data = parse_fl_6tier(pdf_path)
            out_path = DATA_DIR / plan["out"]
            # Check if data actually changed
            old_hash = hashlib.md5(open(out_path, "rb").read()).hexdigest() if out_path.exists() else ""
            new_json = json.dumps(data, indent=2)
            new_hash = hashlib.md5(new_json.encode()).hexdigest()
            if old_hash == new_hash:
                print("  No change — skipping")
            else:
                with open(out_path, "w") as f:
                    f.write(new_json)
                total = sum(len(c["clean"]) + len(c["restricted"]) for c in data)
                print(f"  Updated: {len(data)} conditions, {total} drugs")
                updated.append(plan["id"])
        except Exception as e:
            print(f"  ERROR: {e}")

    print("\n=== UHC Plans ===")
    for plan in UHC_PLANS:
        print(f"\n[{plan['id']}]")
        url = find_latest_uhc_url(plan["type"])
        if not url:
            print("  Could not find current PDF — skipping")
            continue
        pdf_path = tmp / f"{plan['id']}.pdf"
        try:
            download_pdf(url, pdf_path)
            print("  Parsing...")
            data = parse_uhc(pdf_path)
            out_path = DATA_DIR / plan["out"]
            old_hash = hashlib.md5(open(out_path, "rb").read()).hexdigest() if out_path.exists() else ""
            new_json = json.dumps(data, indent=2)
            new_hash = hashlib.md5(new_json.encode()).hexdigest()
            if old_hash == new_hash:
                print("  No change — skipping")
            else:
                with open(out_path, "w") as f:
                    f.write(new_json)
                total = sum(len(c["clean"]) + len(c["restricted"]) for c in data)
                print(f"  Updated: {len(data)} conditions, {total} drugs")
                updated.append(plan["id"])
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\n=== Done. Updated: {updated or 'none'} ===")
    # Exit code 0 even if nothing updated — GitHub Actions won't fail
    return 0

if __name__ == "__main__":
    sys.exit(main())
