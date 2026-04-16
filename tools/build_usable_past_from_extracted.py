from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
APP_DIR = ROOT / "mockups" / "pm-dojo"
TEXT_DIR = ROOT / ".tmp" / "ipa-pm-bank" / "raw" / "text"
DRAFT_DIR = ROOT / ".tmp" / "ipa-pm-bank" / "draft"
OUT = APP_DIR / "data" / "past-questions.js"
DRAFT_OUT = DRAFT_DIR / "past-questions.usable.js"


FW_TO_INT = str.maketrans("０１２３４５６７８９", "0123456789")


def clean(s: str) -> str:
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"^\s*\d+/\d+\s*$", "", s, flags=re.M)
    s = re.sub(r"^©\d{4} 独立行政法人情報処理推進機構\s*$", "", s, flags=re.M)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def compact(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def header_label(text: str) -> tuple[str, str]:
    for line in text.splitlines():
        if "プロジェクトマネージャ試験" in line and "令和" in line:
            label = compact(line)
            label = label.replace(" 出題趣旨", "").replace(" 解答例", "").replace(" 採点講評", "")
            label = re.sub(
                r"令和\s*([0-9０-９]+)\s*年度\s*(秋期|春期|10\s*月|10月)",
                lambda m: f"令和{m.group(1).translate(FW_TO_INT)}年度 {m.group(2).replace(' ', '')}",
                label,
            )
            season = "秋期" if "秋" in label else "10月" if "10 月" in label or "10月" in label else ""
            return label, season
    return "プロジェクトマネージャ試験", ""


def q_no_to_int(q: str) -> int:
    return int(q.translate(FW_TO_INT))


def split_questions(text: str) -> dict[int, str]:
    matches = list(re.finditer(r"(?m)^問\s*([0-9０-９]+)\s*$", text))
    out: dict[int, str] = {}
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        out[q_no_to_int(m.group(1))] = text[start:end].strip()
    return out


def extract_purpose(section: str) -> str:
    m = re.search(r"出題趣旨\s*(.*?)(?:\n\s*設問|\Z)", section, flags=re.S)
    return compact(m.group(1)) if m else ""


def extract_pm1_answers(section: str) -> str:
    m = re.search(r"設問\s+解答例・解答の要点\s+備考\s*(.*)", section, flags=re.S)
    if not m:
        m = re.search(r"設問\s*(.*)", section, flags=re.S)
    if not m:
        return ""
    block = m.group(1)
    block = re.sub(r"^\s*\d+/\d+\s*$", "", block, flags=re.M)
    block = re.sub(r"^©\d{4}.*$", "", block, flags=re.M)
    block = re.sub(r"\n{3,}", "\n\n", block)
    return block.strip()


def expected_points(answer_block: str) -> list[str]:
    items: list[str] = []
    for line in answer_block.splitlines():
        line = compact(line)
        if not line:
            continue
        line = re.sub(r"^設問\s*[0-9０-９]+", "", line).strip()
        line = re.sub(r"^\([0-9０-９]+\)", "", line).strip()
        if not line or line in {"備考"}:
            continue
        if len(line) > 70:
            line = line[:67] + "..."
        if line not in items:
            items.append(line)
        if len(items) >= 5:
            break
    return items


def infer_tags(text: str, period: str) -> list[str]:
    pairs = [
        ("リスク", "リスク"),
        ("ステークホルダ", "ステークホルダー"),
        ("スコープ", "スコープ"),
        ("品質", "品質"),
        ("コスト", "コスト"),
        ("スケジュール", "スケジュール"),
        ("チーム", "チーム"),
        ("育成", "チーム"),
        ("リーダーシップ", "リーダーシップ"),
        ("変更", "変更管理"),
        ("調達", "調達"),
        ("生成 AI", "生成AI"),
        ("稼働開始", "移行・稼働開始"),
    ]
    tags = [period, "IPA過去問"]
    for key, tag in pairs:
        if key in text and tag not in tags:
            tags.append(tag)
    return tags[:6]


def short_title(text: str, fallback: str) -> str:
    if not text:
        return fallback
    first = re.split(r"[。．]", text)[0]
    first = compact(first)
    return first[:42] + ("..." if len(first) > 42 else "")


def source(code: str, label: str, season: str, period: str, question_no: str) -> dict[str, str]:
    return {
        "year": label.split(" プロジェクトマネージャ試験")[0],
        "season": season,
        "exam": "プロジェクトマネージャ試験",
        "period": period,
        "questionNo": question_no,
        "url": f"https://www.ipa.go.jp/shiken/mondai-kaiotu/{code}.html",
        "attribution": f"出典：{label} {period} {question_no}",
    }


def build_pm1_short(code: str, path: Path) -> list[dict]:
    text = clean(path.read_text(encoding="utf-8"))
    label, season = header_label(text)
    records: list[dict] = []
    for qno, section in split_questions(text).items():
        purpose = extract_purpose(section)
        answers = extract_pm1_answers(section)
        if not purpose or not answers:
            continue
        qlabel = f"問{qno}"
        records.append({
            "id": f"pm-{code}-pm1-q{qno}",
            "kind": "short",
            "tags": infer_tags(purpose + " " + answers, "午後I"),
            "limit": "80〜140字",
            "prompt": f"{label} 午後I {qlabel}。出題趣旨を踏まえ、PMとして押さえるべき観点を短文で整理してください。",
            "expectedPoints": expected_points(answers),
            "sampleAnswer": answers,
            "source": source(code, label, season, "午後I", qlabel),
            "_review": "問題冊子本文はOCR待ち。解答例・解答の要点から作成。",
        })
    return records


def build_pm2_essays(code: str, ans_path: Path, cmnt_path: Path | None) -> list[dict]:
    ans_text = clean(ans_path.read_text(encoding="utf-8"))
    label, season = header_label(ans_text)
    comments = split_questions(clean(cmnt_path.read_text(encoding="utf-8"))) if cmnt_path and cmnt_path.exists() else {}
    records: list[dict] = []
    for qno, section in split_questions(ans_text).items():
        purpose = extract_purpose(section)
        if not purpose:
            continue
        comment = compact(comments.get(qno, ""))
        qlabel = f"問{qno}"
        theme = short_title(purpose, f"{label} 午後II {qlabel}")
        tags = infer_tags(purpose + " " + comment, "午後II")
        hint = purpose
        if comment:
            hint = f"{purpose}\n\n採点講評メモ：{comment}"
        records.append({
            "id": f"pm-{code}-pm2-q{qno}",
            "kind": "essay",
            "tags": tags,
            "theme": f"{label} 午後II {qlabel}：{theme}",
            "scenario": purpose,
            "requirements": [
                "設問ア：プロジェクト概要、背景、課題を具体化する",
                "設問イ：PMとして実施した計画・対応・工夫をPMBOK観点で書く",
                "設問ウ：対応結果、評価、残課題、教訓を定量的にまとめる",
            ],
            "structure": [
                ["出題趣旨", purpose],
                ["論述で外さない観点", "設問で問われたマネジメント対象を、技術論だけでなくPMの計画・監視・調整・判断として説明する。"],
                ["採点講評メモ", comment or "採点講評テキストは未抽出です。"],
            ],
            "outlineHint": hint,
            "source": source(code, label, season, "午後II", qlabel),
            "_review": "問題冊子本文はOCR待ち。出題趣旨・採点講評から作成。",
        })
    return records


def write_js(records: list[dict], out: Path) -> None:
    banner = (
        "// IPAプロジェクトマネージャ試験 過去問データ\n"
        "// 生成元: .tmp/ipa-pm-bank/raw/text の公式PDF抽出テキスト\n"
        "// 注意: 問題冊子本文はOCR待ちのため、午後Iは解答例、午後IIは出題趣旨・採点講評ベースです。\n"
        "window.PM_DOJO_PAST_QUESTIONS = "
    )
    text = banner + json.dumps(records, ensure_ascii=False, indent=2) + ";\n"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")


def main() -> None:
    records: list[dict] = []
    for pm1 in sorted(TEXT_DIR.glob("*-pm1-ans.txt")):
        code = pm1.name.split("-pm1-ans.txt")[0]
        records.extend(build_pm1_short(code, pm1))
    for pm2 in sorted(TEXT_DIR.glob("*-pm2-ans.txt")):
        code = pm2.name.split("-pm2-ans.txt")[0]
        cmnt = TEXT_DIR / f"{code}-pm2-cmnt.txt"
        records.extend(build_pm2_essays(code, pm2, cmnt))

    write_js(records, OUT)
    DRAFT_DIR.mkdir(parents=True, exist_ok=True)
    write_js(records, DRAFT_OUT)
    counts = {}
    for r in records:
        counts[r["kind"]] = counts.get(r["kind"], 0) + 1
    print(f"wrote {len(records)} records to {OUT}")
    print(counts)


if __name__ == "__main__":
    main()
