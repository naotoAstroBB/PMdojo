from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
DEPS = ROOT / ".tmp" / "pdf-extract-deps"
if DEPS.exists():
    sys.path.insert(0, str(DEPS))

import pymupdf  # type: ignore


def wanted_pdf(path: Path) -> bool:
    name = path.name
    if not name.endswith("_qs.pdf"):
        return False
    return bool(re.match(r"^20\d{2}r\d{2}a_(pm|koudo)_(am1|am2|pm1|pm2)_qs\.pdf$", name))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--downloads", default=str(Path.home() / "Downloads"))
    parser.add_argument("--out", default=str(ROOT / ".tmp" / "ipa-pm-bank" / "local-ocr"))
    parser.add_argument("--scale", type=float, default=3.0)
    args = parser.parse_args()

    downloads = Path(args.downloads)
    out_root = Path(args.out)
    image_root = out_root / "images"
    image_root.mkdir(parents=True, exist_ok=True)

    manifest = []
    for pdf in sorted(downloads.glob("*.pdf")):
        if not wanted_pdf(pdf):
            continue
        stem = pdf.stem
        pdf_dir = image_root / stem
        pdf_dir.mkdir(parents=True, exist_ok=True)
        doc = pymupdf.open(str(pdf))
        pages = []
        for index, page in enumerate(doc, start=1):
            out = pdf_dir / f"p{index:03}.png"
            if not out.exists():
                pix = page.get_pixmap(matrix=pymupdf.Matrix(args.scale, args.scale), alpha=False)
                pix.save(str(out))
            pages.append(str(out))
        manifest.append({
            "pdf": str(pdf),
            "stem": stem,
            "pages": pages,
        })
        print(f"rendered {stem}: {len(pages)} pages")

    manifest_path = out_root / "ocr-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {manifest_path}")


if __name__ == "__main__":
    main()
