#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from responsible_steps_tools import PDF_URL, download_pdf, parse_pdf_targets


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Responsible Steps JSON draft from PDF.")
    parser.add_argument(
      "--pdf-path",
      default="tmp/Rx_ResponsibleSteps.pdf",
      help="Local path for the Responsible Steps PDF.",
    )
    parser.add_argument(
      "--out",
      default="src/data/step_therapy.generated.json",
      help="Output JSON path for generated target->prerequisites mapping.",
    )
    parser.add_argument(
      "--download",
      action="store_true",
      help="Download the latest PDF before parsing.",
    )
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    out_path = Path(args.out)

    if args.download or not pdf_path.exists():
        print(f"Downloading source PDF: {PDF_URL}")
        download_pdf(pdf_path)

    print(f"Parsing {pdf_path} ...")
    parsed = parse_pdf_targets(pdf_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(dict(sorted(parsed.items())), indent=2) + "\n")
    print(f"Wrote {len(parsed)} entries to {out_path}")


if __name__ == "__main__":
    main()
