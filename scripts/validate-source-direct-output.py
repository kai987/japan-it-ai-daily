from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]

BANNED = [
    "meaningZh",
    "noteZh",
    "exampleZh",
    "nuanceZh",
    "usageZh",
    "contextZh",
    "详细文字版",
    "今日最值得看的",
    "分类速览",
    "面试复习卡",
    "重点总结",
    "日本語学习",
    "JLPT词汇",
    "专业词汇",
    "JLPT语法",
    "今日必背",
    "为什么值得看",
    "面试问题",
    "约30秒回答",
    "可关联项目",
    "回答要点",
]

BROKEN_PATTERNS = [
    r"\*\*\*\*",
    r"：：",
    r"。。",
    r"、、",
    r"(?m)^#{1,6}\s+#{1,6}\s+",
    r"(?:\(\)){3,}",
    r"ZXQPH",
]


def parse_markdown(path: Path) -> tuple[dict[str, Any], str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise RuntimeError(f"{path}: missing frontmatter")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise RuntimeError(f"{path}: unterminated frontmatter")
    data = yaml.safe_load(text[4:end]) or {}
    return data, text[end + 5 :].lstrip(), text


def require_equal(a: Any, b: Any, label: str) -> None:
    if a != b:
        raise RuntimeError(f"{label} mismatch: {a!r} != {b!r}")


def validate(date: str, workdir: Path) -> None:
    zh_daily_path = ROOT / "src/content/daily" / f"{date}.md"
    zh_lesson_path = ROOT / "src/content/japanese" / f"{date}.md"
    ja_daily_path = workdir / "daily-ja.md"
    ja_lesson_path = workdir / "japanese-ja.md"

    for path, minimum in ((ja_daily_path, 6500), (ja_lesson_path, 6500)):
        if not path.is_file():
            raise RuntimeError(f"{path}: missing")
        size = path.stat().st_size
        if size < minimum:
            raise RuntimeError(f"{path}: unexpectedly short ({size} bytes)")

    zd, _, _ = parse_markdown(zh_daily_path)
    zl, _, _ = parse_markdown(zh_lesson_path)
    jd, daily_body, daily_text = parse_markdown(ja_daily_path)
    jl, lesson_body, lesson_text = parse_markdown(ja_lesson_path)

    ztop = zd.get("top") or []
    jtop = jd.get("top") or []
    if len(ztop) != 5 or len(jtop) != 5:
        raise RuntimeError("Top 5 count mismatch")
    for index, (source, generated) in enumerate(zip(ztop, jtop, strict=True), 1):
        for key in ("title", "source", "topic", "url"):
            require_equal(source.get(key), generated.get(key), f"Top {index} {key}")
        if not str(generated.get("why") or "").strip():
            raise RuntimeError(f"Top {index} why is empty")

    zv, jv = zl.get("vocabulary") or [], jl.get("vocabulary") or []
    zg, jg = zl.get("grammar") or [], jl.get("grammar") or []
    zt, jt = zl.get("technicalTerms") or [], jl.get("technicalTerms") or []
    if (len(zv), len(zg), len(zt)) != (len(jv), len(jg), len(jt)):
        raise RuntimeError(
            "learning item count mismatch: "
            f"source={(len(zv),len(zg),len(zt))}, generated={(len(jv),len(jg),len(jt))}"
        )

    require_equal(zl.get("vocabularyCount"), jl.get("vocabularyCount"), "vocabularyCount")
    require_equal(zl.get("grammarCount"), jl.get("grammarCount"), "grammarCount")
    require_equal(zl.get("mustRememberWords") or [], jl.get("mustRememberWords") or [], "mustRememberWords")
    require_equal(zl.get("mustRememberGrammar") or [], jl.get("mustRememberGrammar") or [], "mustRememberGrammar")

    for index, (source, generated) in enumerate(zip(zv, jv, strict=True), 1):
        for key in ("term", "reading", "partOfSpeech", "level", "collocations", "exampleJa"):
            require_equal(source.get(key), generated.get(key), f"Vocabulary {index} {key}")
        for key in ("meaning", "note", "exampleMeaning", "nuance"):
            if not str(generated.get(key) or "").strip():
                raise RuntimeError(f"Vocabulary {index} {key} is empty")

    for index, (source, generated) in enumerate(zip(zg, jg, strict=True), 1):
        for key in ("pattern", "level", "structure", "exampleJa"):
            require_equal(source.get(key), generated.get(key), f"Grammar {index} {key}")
        for key in ("meaning", "usage", "exampleMeaning", "note"):
            if not str(generated.get(key) or "").strip():
                raise RuntimeError(f"Grammar {index} {key} is empty")

    for index, (source, generated) in enumerate(zip(zt, jt, strict=True), 1):
        for key in ("term", "japanese"):
            require_equal(source.get(key), generated.get(key), f"Technical term {index} {key}")
        for key in ("meaning", "context"):
            if not str(generated.get(key) or "").strip():
                raise RuntimeError(f"Technical term {index} {key} is empty")

    combined = daily_text + "\n" + lesson_text
    hits = [token for token in BANNED if token in combined]
    if hits:
        raise RuntimeError(f"Chinese labels/schema fields remain: {hits}")
    for pattern in BROKEN_PATTERNS:
        if re.search(pattern, combined):
            raise RuntimeError(f"broken/repeated markup found: {pattern}")

    required_daily_headings = [
        "# A. 詳細版",
        "## 1. 今日読むべき5本",
        "## 2. カテゴリ別サマリー",
        "## 3. 面接で使えるポイント",
        "## 4. 今日の技術テーマ",
        "## 5. 面接復習カード",
        "# B. 重要ポイントと面接で使える知識",
        "# C. 日本語学習｜JLPT + IT日本語",
    ]
    missing = [heading for heading in required_daily_headings if heading not in daily_body]
    if missing:
        raise RuntimeError(f"daily headings missing: {missing}")
    for symbol in ("①", "②", "③", "④", "⑤"):
        if f"### {symbol}" not in daily_body:
            raise RuntimeError(f"daily Top-5 heading {symbol} missing")

    kana_count = len(re.findall(r"[ぁ-んァ-ヴー]", combined))
    if kana_count < 200:
        raise RuntimeError(f"Japanese-language sanity check failed: only {kana_count} kana characters")

    print(
        f"{date}: source-direct validation passed; "
        f"daily={ja_daily_path.stat().st_size} bytes, "
        f"lesson={ja_lesson_path.stat().st_size} bytes, kana={kana_count}",
        flush=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--workdir", default="/tmp/source-direct-ja")
    args = parser.parse_args()
    validate(args.date, Path(args.workdir))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
