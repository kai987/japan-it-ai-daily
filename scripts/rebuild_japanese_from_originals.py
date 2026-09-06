from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path

import requests
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]


def parse_frontmatter(path: Path):
    text = path.read_text(encoding="utf-8")
    end = text.find("\n---\n", 4)
    if not text.startswith("---\n") or end < 0:
        raise RuntimeError(f"{path}: bad frontmatter")
    return yaml.safe_load(text[4:end]) or {}, text, path.stat().st_size


def build_context(date: str):
    daily, _, _ = parse_frontmatter(ROOT / f"src/content/daily/{date}.md")
    lesson, _, _ = parse_frontmatter(ROOT / f"src/content/japanese/{date}.md")
    top = daily.get("top") or []
    if len(top) != 5:
        raise RuntimeError(f"{date}: expected five Top items, got {len(top)}")

    context = {
        "date": date,
        "topics": daily.get("topics") or [],
        "sources": daily.get("sources") or [],
        "top": [
            {
                "index": i + 1,
                "title": x.get("title", ""),
                "source": x.get("source", ""),
                "topic": x.get("topic", ""),
                "url": x.get("url", ""),
            }
            for i, x in enumerate(top)
        ],
        "learning": {
            "topics": lesson.get("topics") or [],
            "levels": lesson.get("levels") or [],
            "vocabularyCount": lesson.get("vocabularyCount", 0),
            "grammarCount": lesson.get("grammarCount", 0),
            "vocabulary": [
                {
                    "term": x.get("term", ""),
                    "reading": x.get("reading", ""),
                    "partOfSpeech": x.get("partOfSpeech", ""),
                    "level": x.get("level", ""),
                    "collocations": x.get("collocations") or [],
                    "exampleJa": x.get("exampleJa", ""),
                }
                for x in (lesson.get("vocabulary") or [])
            ],
            "grammar": [
                {
                    "pattern": x.get("pattern", ""),
                    "level": x.get("level", ""),
                    "structure": x.get("structure", ""),
                    "exampleJa": x.get("exampleJa", ""),
                }
                for x in (lesson.get("grammar") or [])
            ],
            "technicalTerms": [
                {
                    "term": x.get("term", ""),
                    **({"japanese": x.get("japanese")} if x.get("japanese") else {}),
                }
                for x in (lesson.get("technicalTerms") or [])
            ],
            "mustRememberWords": lesson.get("mustRememberWords") or [],
            "mustRememberGrammar": lesson.get("mustRememberGrammar") or [],
        },
    }
    return daily, lesson, context


def direct_text(url: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
        "Accept-Language": "ja,en;q=0.8",
    }
    r = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    for tag in soup(["script", "style", "noscript", "svg", "form", "nav", "footer", "header", "aside"]):
        tag.decompose()
    root = soup.find("article") or soup.find("main") or soup.body or soup
    text = re.sub(r"\n{3,}", "\n\n", root.get_text("\n", strip=True))[:70000]
    return r.url, r.status_code, text


def reader_text(url: str):
    reader = "https://r.jina.ai/" + url
    r = requests.get(reader, headers={"User-Agent": "Mozilla/5.0"}, timeout=45)
    r.raise_for_status()
    return reader, r.status_code, r.text[:70000]


def fetch_sources(date: str, context: dict):
    out_dir = Path("/tmp/original-articles")
    out_dir.mkdir(parents=True, exist_ok=True)
    for idx, item in enumerate(context["top"], 1):
        url = item.get("url") or ""
        path = out_dir / f"{idx:02d}.txt"
        if not url:
            path.write_text("FETCH_STATUS: missing URL\n", encoding="utf-8")
            print(f"WARNING {date} Top {idx}: URL missing", flush=True)
            continue
        try:
            final, status, text = direct_text(url)
            if len(text) < 900:
                raise RuntimeError(f"direct extraction too short ({len(text)})")
            method = "direct"
        except Exception as first:
            try:
                final, status, text = reader_text(url)
                if len(text) < 900:
                    raise RuntimeError(f"reader extraction too short ({len(text)})")
                method = "reader-fallback"
            except Exception as second:
                path.write_text(
                    f"URL: {url}\nFETCH_STATUS: failed\nDIRECT_ERROR: {first}\nFALLBACK_ERROR: {second}\n",
                    encoding="utf-8",
                )
                print(f"WARNING {date} Top {idx} unavailable: {first}; fallback: {second}", flush=True)
                continue
        path.write_text(
            f"URL: {url}\nFETCH_METHOD: {method}\nFETCH_LOCATION: {final}\nHTTP_STATUS: {status}\n"
            f"SOURCE_TITLE: {item.get('title','')}\n\n{text}\n",
            encoding="utf-8",
        )
        print(f"{date} Top {idx}: {method}, {len(text)} chars", flush=True)


def prompt_for(date: str) -> str:
    return f"""You are a senior native-level Japanese technical editor rebuilding the historical Japanese mode of an Astro IT/AI news site.

Rebuild ONLY these two files for {date}:
- src/content/daily-ja/{date}.md
- src/content/japanese-ja/{date}.md

SOURCE POLICY — NON-NEGOTIABLE
Use only /tmp/source-context.json plus /tmp/original-articles/01.txt through 05.txt. They contain immutable Top-5 metadata, the Japanese-learning identity skeleton, and text retrieved from the original article URLs.
Never translate or use Chinese daily prose or Chinese learning explanations. Do not read them as language input. If an original source remains inaccessible, do not invent details; keep that item conservative and use only available source metadata.

FACTUAL CONSISTENCY
Exactly five Top articles in source-context order. title/source/topic/url are immutable. Preserve dates, numbers, product/model names, organizations, APIs and technical facts. Do not add unsupported facts or examples.

STEP 1 — JAPANESE LEARNING FILE
Create src/content/japanese-ja/{date}.md first.
Preserve exact learning item identity/order from source-context.
Frontmatter keys: title,date,description,topics,levels,vocabularyCount,grammarCount,vocabulary,grammar,technicalTerms,mustRememberWords,mustRememberGrammar.
vocabulary fields: term,reading,partOfSpeech,meaning,level,collocations,note,exampleJa,optional exampleMeaning,optional nuance.
grammar fields: pattern,level,meaning,structure,usage,exampleJa,optional exampleMeaning,optional note.
technicalTerms fields: term,optional japanese,meaning,context.
Keep exactly unchanged: vocabulary term/reading/partOfSpeech/level/collocations/exampleJa; grammar pattern/level/structure/exampleJa; technical-term term/japanese; mustRememberWords; mustRememberGrammar.
Write meaning/note/exampleMeaning/nuance/usage/context freshly in idiomatic Japanese grounded in original article context and Japanese dictionary-style definitions. Never mechanically translate Chinese explanation fields. title/description must be natural Japanese. Body may contain only a short Japanese introduction because structured cards render from frontmatter.

STEP 2 — COMPLETE JAPANESE DAILY FILE
Create src/content/daily-ja/{date}.md directly from original sources.
Frontmatter keys exactly title,date,description,topics,sources,top,featured. top has exactly five items. title/source/topic/url exactly match source-context; why is natural Japanese from original sources.

The body MUST be detailed and contain complete A+B+C:
# A. 詳細版
## 1. 今日読むべき5本
Five sections ①–⑤, one for each Top item. Each includes 出典, 原文 URL, at least two substantive Japanese summary paragraphs grounded in the original, and 注目ポイント.
## 2. カテゴリ別サマリー
Cover relevant AI / Agent, Frontend / Web, Cloud / Backend, and 日本企業 Tech Blog / enterprise engineering signals. If a category has no meaningful source item, say so naturally instead of inventing content.
## 3. 面接で使えるポイント
Provide 3–5 topics; each includes a Japanese interview question, a natural roughly-30-second Japanese answer, 関連プロジェクト, and 3つのキーワード.
## 4. 今日の技術テーマ
Explain one central theme in Japanese, with メリット, 制約・リスク, 日本企業で導入する際の注意点.
## 5. 面接復習カード
Three Japanese questions with 回答ポイント.

# B. 重要ポイントと面接で使える知識
This MUST cover all five Top articles separately in the same order. Clearly label them ① ② ③ ④ ⑤ (heading level may be ##, ###, ####, or another clean Markdown structure). For EACH article provide 2–4 concrete Japanese knowledge points grounded in that original article. Do not translate a Chinese B section.

# C. 日本語学習｜JLPT + IT日本語
This MUST be complete, not an intro. Render the same structured learning content from japanese-ja into readable Markdown with the same Japanese explanations:
## C-1. JLPT語彙 — EVERY vocabulary item, with term/reading, partOfSpeech, meaning, collocations, article context/note, exampleJa, optional exampleMeaning/nuance.
## C-2. IT/AI専門用語 — EVERY technical term with Japanese meaning and context.
## C-3. JLPT文法 — EVERY grammar item with level, meaning, structure, usage, exampleJa, optional exampleMeaning/note.
## C-4. 今日の必修 — exactly mustRememberWords and mustRememberGrammar from source-context.
The daily C section and japanese-ja must agree semantically and item-for-item.

QUALITY
Publication-quality idiomatic Japanese, never Chinese-shaped Japanese. Prefer original Japanese terminology and phrasing when available. Keep standard English technical terms when natural. Markdown markers exactly once: no ****, ：：, duplicated list prefixes/headings, broken blockquotes, placeholder tokens, malformed YAML. Reread both files before finishing and fix unnatural Japanese, factual drift, repeated punctuation, malformed Markdown and missing C items.

SAFETY
Do not modify src/content/daily/, src/content/japanese/, framework code, workflow/package/audio files, or any other date. No zh->ja translation pipeline is permitted.
"""


def run_copilot(date: str):
    prompt = prompt_for(date)
    subprocess.run(
        ["copilot", "--yolo", "-s", "--model", "auto", "-p", prompt],
        cwd=ROOT,
        check=True,
        env=os.environ.copy(),
    )


def validate(date: str, source_daily: dict, source_lesson: dict):
    jd, daily_text, daily_bytes = parse_frontmatter(ROOT / f"src/content/daily-ja/{date}.md")
    jl, lesson_text, lesson_bytes = parse_frontmatter(ROOT / f"src/content/japanese-ja/{date}.md")
    print(f"{date}: daily-ja={daily_bytes} bytes, japanese-ja={lesson_bytes} bytes", flush=True)
    if daily_bytes < 14000:
        raise RuntimeError("daily-ja unexpectedly short")
    if lesson_bytes < 5000:
        raise RuntimeError("japanese-ja unexpectedly short")

    required = [
        "# A. 詳細版", "## 1. 今日読むべき5本", "## 2. カテゴリ別サマリー",
        "## 3. 面接で使えるポイント", "## 4. 今日の技術テーマ", "## 5. 面接復習カード",
        "# B. 重要ポイントと面接で使える知識", "# C. 日本語学習｜JLPT + IT日本語",
        "## C-1. JLPT語彙", "## C-2. IT/AI専門用語", "## C-3. JLPT文法", "## C-4. 今日の必修",
    ]
    missing = [x for x in required if x not in daily_text]
    if missing:
        raise RuntimeError(f"missing sections: {missing}")

    ztop, jtop = source_daily.get("top") or [], jd.get("top") or []
    if len(ztop) != 5 or len(jtop) != 5:
        raise RuntimeError("Top 5 count mismatch")
    for i, (a, b) in enumerate(zip(ztop, jtop), 1):
        for key in ("title", "source", "topic", "url"):
            if (a.get(key) or "") != (b.get(key) or ""):
                raise RuntimeError(f"Top {i} {key} mismatch")

    zv, zg, zt = source_lesson.get("vocabulary") or [], source_lesson.get("grammar") or [], source_lesson.get("technicalTerms") or []
    jv, jg, jt = jl.get("vocabulary") or [], jl.get("grammar") or [], jl.get("technicalTerms") or []
    if (len(zv), len(zg), len(zt)) != (len(jv), len(jg), len(jt)):
        raise RuntimeError("learning counts mismatch")
    for i, (a, b) in enumerate(zip(zv, jv), 1):
        for key in ("term", "reading", "partOfSpeech", "level", "collocations", "exampleJa"):
            if a.get(key) != b.get(key):
                raise RuntimeError(f"Vocabulary {i} {key} mismatch")
    for i, (a, b) in enumerate(zip(zg, jg), 1):
        for key in ("pattern", "level", "structure", "exampleJa"):
            if a.get(key) != b.get(key):
                raise RuntimeError(f"Grammar {i} {key} mismatch")
    for i, (a, b) in enumerate(zip(zt, jt), 1):
        for key in ("term", "japanese"):
            if a.get(key) != b.get(key):
                raise RuntimeError(f"Technical term {i} {key} mismatch")
    for key in ("mustRememberWords", "mustRememberGrammar"):
        if (source_lesson.get(key) or []) != (jl.get(key) or []):
            raise RuntimeError(f"{key} mismatch")

    c = daily_text.split("# C. 日本語学習｜JLPT + IT日本語", 1)[1]
    missing_vocab = [x.get("term") for x in jv if x.get("term") and x.get("term") not in c]
    missing_grammar = [x.get("pattern") for x in jg if x.get("pattern") and x.get("pattern") not in c]
    missing_tech = [x.get("term") for x in jt if x.get("term") and x.get("term") not in c]
    if missing_vocab or missing_grammar or missing_tech:
        raise RuntimeError(f"C missing items: vocab={missing_vocab}; grammar={missing_grammar}; tech={missing_tech}")

    b = daily_text.split("# B. 重要ポイントと面接で使える知識", 1)[1].split("# C. 日本語学習｜JLPT + IT日本語", 1)[0]
    if len(b) < 1200:
        raise RuntimeError("B section unexpectedly short")
    missing_markers = [x for x in "①②③④⑤" if x not in b]
    if missing_markers:
        raise RuntimeError(f"B does not clearly cover all five articles: {missing_markers}")

    combined = daily_text + lesson_text
    banned = [
        "meaningZh", "noteZh", "exampleZh", "nuanceZh", "usageZh", "contextZh",
        "详细文字版", "今日最值得看的", "分类速览", "面试复习卡", "重点总结", "日本語学习",
        "JLPT词汇", "专业词汇", "JLPT语法", "今日必背", "为什么值得看", "面试问题",
        "约30秒回答", "可关联项目", "回答要点",
    ]
    hits = [x for x in banned if x in combined]
    if hits:
        raise RuntimeError(f"Chinese labels/schema remain: {hits}")

    simplified = set("这为们对让从该还进过并较仅时种发开关问题报见务动说读认语词汇习间图门长达连选适远类级员资质责财费预领顾额风飞马验驱编线组终给结统经续绿网联职药获营蓝观览视计论设访证评识诉诊译诚询详误请调谈谱负账货购贵贷赔赖赚赠赞轮软轻载辑输边迁运迟递遗邻释鉴闻闭闹阅险隐难雾页顺饮饭馆鲜鸟鸣齐齿龙")
    bad_chars = sorted({x for x in combined if x in simplified})
    if bad_chars:
        raise RuntimeError(f"Simplified-Chinese-only chars remain: {bad_chars[:20]}")

    for pattern in [r"\*\*\*\*", r"：：", r"。。", r"、、", r"(?m)^#{1,6}\s+#{1,6}\s+", r"(?:\(\)){3,}", r"ZXQPH"]:
        if re.search(pattern, combined):
            raise RuntimeError(f"broken/repeated markup: {pattern}")
    print(f"{date}: source-direct validation passed", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("date")
    args = parser.parse_args()
    date = args.date
    source_daily, source_lesson, context = build_context(date)
    Path("/tmp/source-context.json").write_text(json.dumps(context, ensure_ascii=False, indent=2), encoding="utf-8")
    fetch_sources(date, context)
    run_copilot(date)
    validate(date, source_daily, source_lesson)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
