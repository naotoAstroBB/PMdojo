from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
APP_DIR = ROOT / "mockups" / "pm-dojo"
DEPS = ROOT / ".tmp" / "pdf-extract-deps"
OCR_DIR = ROOT / ".tmp" / "ipa-pm-bank" / "local-ocr" / "text"
DOWNLOADS = Path.home() / "Downloads"
OUT = APP_DIR / "data" / "past-questions.js"
DRAFT_OUT = ROOT / ".tmp" / "ipa-pm-bank" / "draft" / "past-questions.with-local-ocr.js"
REPORT_OUT = ROOT / ".tmp" / "ipa-pm-bank" / "draft" / "local-ocr-report.json"

if DEPS.exists():
    sys.path.insert(0, str(DEPS))

from pypdf import PdfReader  # type: ignore


FW_TO_INT = str.maketrans("０１２３４５６７８９", "0123456789")
ANSWERS = {"ア": 0, "イ": 1, "ウ": 2, "エ": 3}


YEAR_LABELS = {
    "2022r04": "令和4年度 秋期",
    "2023r05": "令和5年度 秋期",
    "2024r06": "令和6年度 秋期",
    "2025r07": "令和7年度 秋期",
}


def load_existing() -> list[dict]:
    if not OUT.exists():
        return []
    text = OUT.read_text(encoding="utf-8")
    if "=" not in text:
        return []
    body = text.split("=", 1)[1].rsplit(";", 1)[0]
    return json.loads(body)


def clean_pdf_text(s: str) -> str:
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"^\s*\d+/\d+\s*$", "", s, flags=re.M)
    s = re.sub(r"^©\d{4}.*$", "", s, flags=re.M)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def extract_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    return clean_pdf_text("\n".join((page.extract_text() or "") for page in reader.pages))


def answer_key(path: Path) -> dict[int, int]:
    text = extract_pdf_text(path)
    out: dict[int, int] = {}
    for m in re.finditer(r"問\s*([0-9０-９]{1,2})\s*([アイウエ])", text):
        out[int(m.group(1).translate(FW_TO_INT))] = ANSWERS[m.group(2)]
    return out


def split_ocr_pages(text: str) -> list[tuple[int, str]]:
    parts = re.split(r"---PAGE p([0-9]{3})---", text)
    pages: list[tuple[int, str]] = []
    for i in range(1, len(parts), 2):
        pages.append((int(parts[i]), parts[i + 1]))
    return pages


def normalize_ocr(s: str) -> str:
    s = s.translate(FW_TO_INT)
    replacements = {
        "プロジエクト": "プロジェクト",
        "ブロジエクト": "プロジェクト",
        "プロジ ェクト": "プロジェクト",
        "チエーン": "チェーン",
        "チエック": "チェック",
        "バッフア": "バッファ",
        "インブット": "インプット",
        "アウトブット": "アウトプット",
        "バラメータ": "パラメータ",
        "エ数": "工数",
        "ェ ": "エ ",
        "工 ": "エ ",
    }
    for old, new in replacements.items():
        s = s.replace(old, new)
    s = re.sub(r"(?<=[\u3040-\u30ff\u3400-\u9fffA-Za-z0-9])\s+(?=[\u3040-\u30ff\u3400-\u9fffA-Za-z0-9])", "", s)
    for old, new in replacements.items():
        s = s.replace(old, new)
    s = re.sub(r"\s+", " ", s)
    s = s.replace(" ,", "，").replace(" 。", "。")
    return s.strip()


def blocks_from_ocr(path: Path, expected_count: int) -> dict[int, str]:
    raw = path.read_text(encoding="utf-8")
    pages = split_ocr_pages(raw)
    body = " ".join(text for page_no, text in pages if page_no >= 3)
    text = normalize_ocr(body)
    if "2023r05a_koudo_am1_qs" in path.name:
        text = text.replace("問囲Y社", "問20Y社")
    if "2024r06a_pm_am2_qs" in path.name and "問17アジャイル" not in text:
        text = text.replace("アジャイルソフトウエア開発宣", "問17アジャイルソフトウエア開発宣", 1)
    markers = list(re.finditer(r"問\s*[0-9]{1,2}", text))
    if not markers:
        return {}

    blocks: dict[int, str] = {}
    marker_infos: list[tuple[int, int]] = []
    for m in markers:
        n = re.search(r"[0-9]{1,2}", m.group(0))
        if n:
            marker_infos.append((int(n.group(0)), m.start()))

    nums = [n for n, _ in marker_infos]
    use_recognized_numbers = (
        nums
        and nums == sorted(nums)
        and len(nums) == len(set(nums))
        and min(nums) >= 1
        and max(nums) <= expected_count
    )

    numbered_starts: list[tuple[int, int]] = []
    if use_recognized_numbers:
        if nums[0] > 1:
            numbered_starts.append((1, 0))
        numbered_starts.extend(marker_infos)
    else:
        # Some pages OCR "問20" as "問29" or miss the left-margin question number.
        # In that case the physical order is more reliable than the recognized number.
        first_num = nums[0] if nums else 1
        starts = [m.start() for m in markers] if first_num == 1 else [0] + [m.start() for m in markers]
        numbered_starts = [(i + 1, start) for i, start in enumerate(starts)]

    for offset, (qno, start) in enumerate(numbered_starts):
        if qno > expected_count:
            continue
        end = numbered_starts[offset + 1][1] if offset + 1 < len(numbered_starts) else len(text)
        block = text[start:end].strip()
        block = re.sub(r"^問\s*[0-9]{1,2}", "", block).strip()
        block = re.sub(r"---PAGEp?[0-9]{3}---", "", block)
        block = re.sub(r"\s*[0-9]{1,2}\s*$", "", block).strip()
        if block:
            blocks[qno] = block
    return blocks


def code_parts(stem: str) -> tuple[str, str, str, int]:
    m = re.match(r"^(20\d{2}r\d{2})a_(pm|koudo)_(am1|am2)_qs$", stem)
    if not m:
        raise ValueError(stem)
    code, exam_group, period_code = m.groups()
    period = "午前I" if period_code == "am1" else "午前II"
    expected = 30 if period_code == "am1" else 25
    return code, exam_group, period, expected


def source_for(code: str, exam_group: str, period: str, qno: int) -> dict[str, str]:
    year = YEAR_LABELS.get(code, code)
    exam = "高度共通午前I（プロジェクトマネージャ試験含む）" if exam_group == "koudo" else "プロジェクトマネージャ試験"
    return {
        "year": year,
        "season": "秋期",
        "exam": exam,
        "period": period,
        "questionNo": f"問{qno}",
        "url": f"https://www.ipa.go.jp/shiken/mondai-kaiotu/{code}.html",
        "attribution": f"出典：{year} {exam} {period} 問{qno}",
    }


def build_choice_records() -> tuple[list[dict], list[dict]]:
    records: list[dict] = []
    report: list[dict] = []
    for ocr_path in sorted(OCR_DIR.glob("*_qs.ocr.txt")):
        stem = ocr_path.name.removesuffix(".ocr.txt")
        if "_pm1_" in stem or "_pm2_" in stem:
            continue
        try:
            code, exam_group, period, expected = code_parts(stem)
        except ValueError:
            continue

        ans_name = stem.replace("_qs", "_ans") + ".pdf"
        ans_path = DOWNLOADS / ans_name
        if not ans_path.exists():
            report.append({"stem": stem, "status": "missing_answer_pdf", "answerPdf": str(ans_path)})
            continue

        answers = answer_key(ans_path)
        blocks = blocks_from_ocr(ocr_path, expected)
        made = 0
        missing = []
        for qno in range(1, expected + 1):
            block = blocks.get(qno, "")
            ans = answers.get(qno)
            if not block or ans is None:
                missing.append(qno)
                continue
            period_id = "am1" if period == "午前I" else "am2"
            code_id = f"past-{code}-{exam_group}-{period_id}-q{qno}"
            records.append({
                "id": code_id,
                "kind": "choice",
                "tags": [period, "択一", "IPA過去問", "OCR"],
                "question": block,
                "choices": ["ア", "イ", "ウ", "エ"],
                "answer": ans,
                "source": source_for(code, exam_group, period, qno),
                "_review": "問題冊子PDFをWindows OCRで抽出。図表・記号・一部文字は要確認。",
            })
            made += 1
        report.append({
            "stem": stem,
            "expected": expected,
            "answers": len(answers),
            "ocrBlocks": len(blocks),
            "records": made,
            "missing": missing,
        })
    return records, report


def excerpt(text: str, limit: int = 2200) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[:limit].rstrip() + "..."


def enrich_pm_records(records: list[dict]) -> None:
    for code in YEAR_LABELS:
        pm1_path = OCR_DIR / f"{code}a_pm_pm1_qs.ocr.txt"
        if pm1_path.exists():
            for qno, block in blocks_from_ocr(pm1_path, 3).items():
                rid = f"pm-{code}-pm1-q{qno}"
                for record in records:
                    if record.get("id") == rid:
                        record["questionText"] = excerpt(block)
                        record["_review"] = f"{record.get('_review', '')} 問題冊子OCR抜粋あり。".strip()

        pm2_path = OCR_DIR / f"{code}a_pm_pm2_qs.ocr.txt"
        if pm2_path.exists():
            for qno, block in blocks_from_ocr(pm2_path, 2).items():
                rid = f"pm-{code}-pm2-q{qno}"
                for record in records:
                    if record.get("id") == rid:
                        record["questionText"] = excerpt(block)
                        structure = record.get("structure") or []
                        if not any(row and row[0] == "問題冊子OCR抜粋" for row in structure):
                            structure.append(["問題冊子OCR抜粋", record["questionText"]])
                        record["structure"] = structure
                        record["_review"] = f"{record.get('_review', '')} 問題冊子OCR抜粋あり。".strip()


def write_js(records: list[dict], out: Path) -> None:
    banner = (
        "// IPAプロジェクトマネージャ試験 過去問データ\n"
        "// 午前I/午前IIの問題冊子はWindows OCR、午後I/午後IIは公式解答例・出題趣旨から生成。\n"
        "// OCR由来の択一問題は図表・記号・一部文字の確認余地があります。\n"
        "window.PM_DOJO_PAST_QUESTIONS = "
    )
    out.write_text(banner + json.dumps(records, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


def main() -> None:
    existing = [r for r in load_existing() if r.get("kind") != "choice"]
    enrich_pm_records(existing)
    choices, report = build_choice_records()
    by_id = {r["id"]: r for r in existing + choices}
    merged = list(by_id.values())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    DRAFT_OUT.parent.mkdir(parents=True, exist_ok=True)
    write_js(merged, OUT)
    write_js(merged, DRAFT_OUT)
    REPORT_OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(merged)} records to {OUT}")
    print({
        "choice": sum(1 for r in merged if r.get("kind") == "choice"),
        "short": sum(1 for r in merged if r.get("kind") == "short"),
        "essay": sum(1 for r in merged if r.get("kind") == "essay"),
    })
    for row in report:
        print(row)


if __name__ == "__main__":
    main()
