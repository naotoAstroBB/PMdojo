"""
IPA PM過去問バンク生成ツール。

目的:
  - IPA公式の過去問題ページからPM試験PDFリンクを収集
  - PDFをローカルの .tmp/ipa-pm-bank に保存
  - 抽出できるPDFはテキスト化
  - アプリに読み込めるJSデータの下書きを data/past/ に生成

注意:
  - PDF抽出は年度・PDF構造によって崩れることがあります。
  - 生成されたデータは必ず目視確認してからGitHubへ上げてください。
  - IPA過去問の出典は必ず残してください。
"""

from __future__ import annotations

import argparse
import html.parser
import json
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TMP_ROOT = ROOT.parents[1] / ".tmp" / "ipa-pm-bank"
DRAFT_ROOT = TMP_ROOT / "draft"
RAW_ROOT = TMP_ROOT / "raw"
DATA_PAST = ROOT / "data" / "past"
OFFICIAL_INDEX = "https://www.ipa.go.jp/shiken/mondai-kaiotu/index.html"


FALLBACK_YEAR_PAGES = [
    "https://www.ipa.go.jp/shiken/mondai-kaiotu/2025r07.html",
    "https://www.ipa.go.jp/shiken/mondai-kaiotu/2024r06.html",
    "https://www.ipa.go.jp/shiken/mondai-kaiotu/2023r05.html",
    "https://www.ipa.go.jp/shiken/mondai-kaiotu/2022r04.html",
]


@dataclass
class PdfSource:
    year_page: str
    pdf_url: str
    filename: str
    year_label: str
    period: str
    doc_type: str
    attribution: str
    local_pdf: str = ""
    local_text: str = ""
    extract_status: str = "pending"


class LinkParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() != "a":
            return
        for key, value in attrs:
            if key.lower() == "href" and value:
                self.links.append(value)


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "PMdojo-importer/1.0"})
    with urllib.request.urlopen(req, timeout=45) as res:
        return res.read().decode("utf-8", errors="replace")


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "PMdojo-importer/1.0"})
    with urllib.request.urlopen(req, timeout=90) as res:
        return res.read()


def links_from_html(base_url: str, html: str) -> list[str]:
    parser = LinkParser()
    parser.feed(html)
    return [urllib.parse.urljoin(base_url, href) for href in parser.links]


def discover_year_pages(limit: int | None) -> list[str]:
    try:
        html = fetch_text(OFFICIAL_INDEX)
        links = links_from_html(OFFICIAL_INDEX, html)
        pages = sorted({
            link for link in links
            if re.search(r"/20\d{2}r\d{2}\.html$", link)
        }, reverse=True)
    except Exception:
        pages = FALLBACK_YEAR_PAGES[:]

    if not pages:
        pages = FALLBACK_YEAR_PAGES[:]
    return pages[:limit] if limit else pages


def infer_year_label(year_page: str) -> str:
    m = re.search(r"/(20\d{2})r(\d{2})\.html$", year_page)
    if not m:
        return "年度不明"
    western = int(m.group(1))
    reiwa = int(m.group(2))
    return f"令和{reiwa}年度"


def infer_period_and_type(filename: str) -> tuple[str, str]:
    name = filename.lower()
    period = "不明"
    if "_am1_" in name:
        period = "午前I"
    elif "_am2_" in name:
        period = "午前II"
    elif "_pm1_" in name:
        period = "午後I"
    elif "_pm2_" in name:
        period = "午後II"

    doc_type = "不明"
    if name.endswith("_qs.pdf"):
        doc_type = "問題冊子"
    elif name.endswith("_ans.pdf"):
        doc_type = "解答例"
    elif name.endswith("_cmnt.pdf") or "comment" in name:
        doc_type = "採点講評"
    elif "haiten" in name or "score" in name:
        doc_type = "配点割合"
    return period, doc_type


def collect_pm_pdfs(year_page: str) -> list[PdfSource]:
    html = fetch_text(year_page)
    links = links_from_html(year_page, html)
    year_label = infer_year_label(year_page)
    sources: list[PdfSource] = []

    for link in links:
        lower = link.lower()
        if not lower.endswith(".pdf"):
            continue
        filename = urllib.parse.unquote(Path(urllib.parse.urlparse(link).path).name)
        # Project Manager exam PDFs use names like:
        #   2025r07a_pm_am2_qs.pdf
        #   2025r07a_pm_pm1_qs.pdf
        #   2025r07a_pm_pm2_qs.pdf
        # Avoid matching AP/SC afternoon PDFs such as 2025r07a_ap_pm_qs.pdf.
        if not re.search(r"_pm_(am2|pm1|pm2)_", filename.lower()):
            continue
        period, doc_type = infer_period_and_type(filename)
        attribution = f"出典：{year_label} プロジェクトマネージャ試験 {period} {doc_type}"
        sources.append(PdfSource(
            year_page=year_page,
            pdf_url=link,
            filename=filename,
            year_label=year_label,
            period=period,
            doc_type=doc_type,
            attribution=attribution,
        ))
    return sources


def extract_pdf_text(pdf_path: Path) -> tuple[str, str]:
    sys.path.insert(0, str(ROOT.parents[1] / ".tmp" / "pmdojo-pydeps"))

    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        if text:
            return text, "ok:pypdf"
    except Exception:
        pass

    try:
        import fitz  # type: ignore
        if hasattr(fitz, "open"):
            doc = fitz.open(str(pdf_path))
            text = "\n".join(page.get_text("text") for page in doc).strip()
            if text:
                return text, "ok:pymupdf"
    except Exception:
        pass

    try:
        import pymupdf  # type: ignore
        if hasattr(pymupdf, "open"):
            doc = pymupdf.open(str(pdf_path))
            text = "\n".join(page.get_text("text") for page in doc).strip()
            if text:
                return text, "ok:pymupdf"
    except Exception:
        pass

    return "", "needs_ocr_or_manual_review"


def make_safe_slug(source: PdfSource) -> str:
    year = re.search(r"20\d{2}r\d{2}", source.year_page)
    year_slug = year.group(0) if year else "unknown"
    period = {
        "午前I": "am1",
        "午前II": "am2",
        "午後I": "pm1",
        "午後II": "pm2",
    }.get(source.period, "unknown")
    doc_type = {
        "問題冊子": "qs",
        "解答例": "ans",
        "採点講評": "cmnt",
        "配点割合": "score",
    }.get(source.doc_type, "doc")
    return f"{year_slug}-{period}-{doc_type}"


def generate_js_skeleton(sources: list[PdfSource], out_path: Path) -> None:
    rows = []
    for source in sources:
        if source.doc_type != "問題冊子":
            continue
        kind = "choice" if source.period in {"午前I", "午前II"} else "short" if source.period == "午後I" else "essay"
        rows.append({
            "id": make_safe_slug(source),
            "kind": kind,
            "source": {
                "year": source.year_label,
                "season": "秋期" if "a_" in source.filename else "",
                "exam": "プロジェクトマネージャ試験",
                "period": source.period,
                "questionNo": "",
                "url": source.year_page,
                "pdf": source.pdf_url,
                "attribution": source.attribution,
            },
            "tags": [source.period, "IPA過去問"],
            "_status": source.extract_status,
            "_rawTextPath": source.local_text,
            "question": "" if kind == "choice" else None,
            "choices": [] if kind == "choice" else None,
            "answer": None if kind == "choice" else None,
            "prompt": "" if kind == "short" else None,
            "expectedPoints": [] if kind == "short" else None,
            "sampleAnswer": "" if kind == "short" else None,
            "theme": "" if kind == "essay" else None,
            "requirements": [] if kind == "essay" else None,
            "outlineHint": "" if kind == "essay" else None,
            "note": "PDF抽出後、目視確認してから問題単位へ分割してください。",
        })

    # Remove keys with None to keep the generated file readable.
    cleaned = [{k: v for k, v in row.items() if v is not None} for row in rows]
    js = (
        "// 自動生成された過去問データ下書きです。\n"
        "// このファイルは .tmp 配下のレビュー用です。確認済みの問題だけ data/past-questions.js へ移してください。\n"
        "// _status と _rawTextPath は作業用メタ情報です。公開用データからは削除してOKです。\n"
        "window.PM_DOJO_PAST_QUESTIONS = "
        + json.dumps(cleaned, ensure_ascii=False, indent=2)
        + ";\n"
    )
    out_path.write_text(js, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit-years", type=int, default=4, help="取得する年度ページ数。0なら発見できた全年度。")
    parser.add_argument("--download", action="store_true", help="PDFを実際にダウンロードする。")
    parser.add_argument("--extract", action="store_true", help="PDFからテキスト抽出する。")
    args = parser.parse_args()

    limit = None if args.limit_years == 0 else args.limit_years
    TMP_ROOT.mkdir(parents=True, exist_ok=True)
    DRAFT_ROOT.mkdir(parents=True, exist_ok=True)
    RAW_ROOT.mkdir(parents=True, exist_ok=True)

    pages = discover_year_pages(limit)
    all_sources: list[PdfSource] = []
    for page in pages:
        try:
            all_sources.extend(collect_pm_pdfs(page))
        except Exception as exc:
            print(f"WARN: {page}: {exc}")

    for source in all_sources:
        slug = make_safe_slug(source)
        pdf_dir = RAW_ROOT / "pdf"
        txt_dir = RAW_ROOT / "text"
        pdf_dir.mkdir(parents=True, exist_ok=True)
        txt_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = pdf_dir / source.filename
        txt_path = txt_dir / f"{slug}.txt"

        if args.download:
            if not pdf_path.exists():
                print(f"download {source.pdf_url}")
                pdf_path.write_bytes(fetch_bytes(source.pdf_url))
            source.local_pdf = str(pdf_path.relative_to(ROOT.parents[1]))

        if args.extract and pdf_path.exists():
            text, status = extract_pdf_text(pdf_path)
            source.extract_status = status
            if text:
                txt_path.write_text(text, encoding="utf-8")
                source.local_text = str(txt_path.relative_to(ROOT.parents[1]))
            else:
                source.local_text = ""

    manifest = TMP_ROOT / "manifest.json"
    manifest.write_text(json.dumps([asdict(s) for s in all_sources], ensure_ascii=False, indent=2), encoding="utf-8")
    draft_path = DRAFT_ROOT / "past-questions.generated.js"
    generate_js_skeleton(all_sources, draft_path)

    print(f"year pages: {len(pages)}")
    print(f"pm pdfs: {len(all_sources)}")
    print(f"manifest: {manifest}")
    print(f"draft: {draft_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
