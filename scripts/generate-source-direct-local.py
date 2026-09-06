from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import requests
import yaml


def strip_thinking(text: str) -> str:
    value = re.sub(r"<think>.*?</think>", "", text, flags=re.S | re.I).strip()
    value = re.sub(r"^```(?:markdown|yaml|json)?\s*", "", value, flags=re.I)
    value = re.sub(r"\s*```$", "", value).strip()
    return value


def extract_json(text: str) -> dict[str, Any]:
    clean = strip_thinking(text)
    start = clean.find("{")
    end = clean.rfind("}")
    if start < 0 or end < start:
        raise ValueError("model response did not contain a JSON object")
    return json.loads(clean[start : end + 1])


def dump_markdown(frontmatter: dict[str, Any], body: str) -> str:
    front = yaml.safe_dump(
        frontmatter,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=1000,
    ).rstrip()
    return f"---\n{front}\n---\n\n{body.strip()}\n"


class LocalChat:
    def __init__(self, base_url: str, model: str) -> None:
        self.url = base_url.rstrip("/") + "/v1/chat/completions"
        self.model = model
        self.system = (
            "あなたは日本のIT/AI技術メディアのシニア編集者です。"
            "自然で正確な日本語だけを書き、中国語から翻訳してはいけません。"
            "与えられた原文と事実メタデータだけを根拠にし、推測を加えません。"
            "MarkdownとJSONを壊さず、重複記号を出しません。 /no_think"
        )

    def ask(self, prompt: str, max_tokens: int) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.system},
                {"role": "user", "content": prompt + "\n/no_think"},
            ],
            "temperature": 0.7,
            "top_p": 0.8,
            "max_tokens": max_tokens,
            "presence_penalty": 1.2,
        }
        response = requests.post(self.url, json=payload, timeout=3600)
        response.raise_for_status()
        data = response.json()
        return strip_thinking(data["choices"][0]["message"]["content"])


def load_originals(workdir: Path) -> str:
    parts: list[str] = []
    for index in range(1, 6):
        path = workdir / "originals" / f"{index:02d}.txt"
        parts.append(f"\n\n===== ORIGINAL ARTICLE {index} =====\n{path.read_text(encoding='utf-8')}")
    return "".join(parts)


def clean_body(text: str) -> str:
    value = strip_thinking(text)
    # A body-only response must not carry a second YAML frontmatter block.
    if value.startswith("---\n"):
        end = value.find("\n---\n", 4)
        if end >= 0:
            value = value[end + 5 :].lstrip()
    return value.strip()


def daily_frontmatter(context: dict[str, Any], body: str) -> dict[str, Any]:
    points = re.findall(r"\*\*注目ポイント[：:]\*\*\s*([^\n]+)", body)
    top: list[dict[str, Any]] = []
    for index, item in enumerate(context["top"]):
        if index < len(points):
            why = points[index].strip()
        else:
            topic = item.get("topic") or "IT・AI"
            why = f"{topic}の最新動向と実装上の論点を、原文から具体的に確認できるため。"
        top.append(
            {
                "title": item.get("title", ""),
                "source": item.get("source", ""),
                **({"topic": item.get("topic")} if item.get("topic") else {}),
                "why": why,
                **({"url": item.get("url")} if item.get("url") else {}),
            }
        )

    topics = context.get("topics") or []
    topic_label = "・".join(str(x) for x in topics[:2]) if topics else "IT・AI"
    return {
        "title": f"日本IT・AI日報｜{topic_label}",
        "date": context["date"],
        "description": f"{context['date']}の日本IT・AI主要トピックを、原文に基づいて技術・面接・学習の観点から整理します。",
        "topics": topics,
        "sources": context.get("sources") or [],
        "top": top,
        "featured": bool(context.get("featured", False)),
    }


def generate_daily(chat: LocalChat, context: dict[str, Any], originals: str) -> str:
    prompt = f"""
以下の SOURCE CONTEXT と ORIGINAL ARTICLES だけを根拠に、{context['date']} の日本語モード詳細日報の「本文だけ」を作成してください。中国語の中間稿は存在しないものとして扱ってください。

SOURCE CONTEXT:
{json.dumps(context, ensure_ascii=False, indent=2)}

ORIGINAL ARTICLES:
{originals}

必須条件:
- 出力は Markdown 本文だけ。YAML frontmatter、コードフェンス、前置き、作業報告は禁止。
- 必ず次の構成をこの順序で使う:
  # A. 詳細版
  ## 1. 今日読むべき5本
  ### ① <SOURCE CONTEXTの1番目のタイトルを一字一句そのまま>
  ... ⑤まで
  ## 2. カテゴリ別サマリー
  ## 3. 面接で使えるポイント
  ## 4. 今日の技術テーマ
  ## 5. 面接復習カード
  # B. 重要ポイントと面接で使える知識
  # C. 日本語学習｜JLPT + IT日本語
- 5記事は SOURCE CONTEXT と同じ順序。各記事に必ず「**出典：**」「**原文 URL：**」「**注目ポイント：**」を1回ずつ含める。
- 原文 URL は SOURCE CONTEXT の値をそのまま使う。
- 各記事の要約は原文から直接、自然な日本語の技術文としてまとめる。日本語原文の用語・語感を優先する。
- 取得に失敗した記事はタイトル・出典・topicから確認できる範囲を超えて断定しない。「取得できなかった」という内部事情を読者向け本文に書く必要はない。
- ## 3 は3〜5テーマ。各テーマに面接質問、約30秒の自然な日本語回答、関連プロジェクト、3つの日本語技術キーワードを含める。
- ## 4 は当日のTop 5を横断する技術テーマを、概要・メリット・制約・日本企業での導入時の注意点まで日本語で説明する。
- ## 5 は3問の面接復習カード。
- BはTop 5の原文から直接、記事ごとに2〜4点を再整理する。中国語版を想定して翻訳しない。
- Cは同日の構造化学習カードへの短い日本語導入だけでよい。別の語彙セットを作らない。
- ****、：：、()()()、重複見出し、重複箇条書き、壊れたMarkdown、プレースホルダーは禁止。
- 最後に自分で読み直し、不自然な直訳調、事実のずれ、重複記号を修正してから本文だけを返す。
""".strip()
    body = clean_body(chat.ask(prompt, max_tokens=6500))
    required = [
        "# A. 詳細版",
        "## 1. 今日読むべき5本",
        "## 2. カテゴリ別サマリー",
        "## 3. 面接で使えるポイント",
        "## 4. 今日の技術テーマ",
        "## 5. 面接復習カード",
        "# B. 重要ポイントと面接で使える知識",
        "# C. 日本語学習｜JLPT + IT日本語",
    ]
    missing = [heading for heading in required if heading not in body]
    if missing:
        raise RuntimeError(f"daily model output is missing headings: {missing}")
    return dump_markdown(daily_frontmatter(context, body), body)


def generate_lesson(chat: LocalChat, context: dict[str, Any], originals: str) -> str:
    learning = context["learning"]
    vocabulary_count = len(learning.get("vocabulary") or [])
    grammar_count = len(learning.get("grammar") or [])
    technical_count = len(learning.get("technicalTerms") or [])
    prompt = f"""
{context['date']} の日本語学習カード用説明を作成してください。中国語の説明を翻訳してはいけません。次の learning skeleton と原文だけから、日本語辞典のような自然な意味説明と、当日のIT/AI記事文脈に即した説明を書いてください。

LEARNING SKELETON:
{json.dumps(learning, ensure_ascii=False, indent=2)}

ORIGINAL ARTICLES:
{originals}

JSONだけを返してください。コードフェンス、前置き、説明は禁止。形式は厳密に次の通りです:
{{
  "vocabulary": [
    {{"meaning":"...","note":"...","exampleMeaning":"...","nuance":"..."}}
  ],
  "grammar": [
    {{"meaning":"...","usage":"...","exampleMeaning":"...","note":"..."}}
  ],
  "technicalTerms": [
    {{"meaning":"...","context":"..."}}
  ]
}}

- vocabulary はちょうど {vocabulary_count} 件、grammar はちょうど {grammar_count} 件、technicalTerms はちょうど {technical_count} 件。skeletonと同じ順序。
- vocabulary の term/reading/partOfSpeech/level/collocations/exampleJa 自体は出力しない。対応する説明だけを同じ順序で書く。
- grammar の pattern/level/structure/exampleJa 自体は出力しない。
- technical termのterm/japanese自体は出力しない。
- meaning/note/usage/contextは、原文の日本語や一般的な日本語の技術用法に沿って新しく日本語で書く。
- exampleMeaning は既存 exampleJa の意味を、同じく日本語で平易に言い換える。
- nuance は近義語との差、語感、使用上の注意を日本語で説明する。
- 中国語字段名や中国語説明、機械翻訳調の文を混ぜない。
""".strip()

    raw = chat.ask(prompt, max_tokens=6000)
    try:
        generated = extract_json(raw)
    except Exception:
        repair = (
            "次の出力を内容を変えずに、有効なJSONオブジェクトだけに修正してください。"
            "コードフェンスや説明は禁止。 /no_think\n\n" + raw
        )
        generated = extract_json(chat.ask(repair, max_tokens=6000))

    gv = generated.get("vocabulary") or []
    gg = generated.get("grammar") or []
    gt = generated.get("technicalTerms") or []
    if (len(gv), len(gg), len(gt)) != (vocabulary_count, grammar_count, technical_count):
        raise RuntimeError(
            "lesson model output count mismatch: "
            f"got {(len(gv),len(gg),len(gt))}, expected {(vocabulary_count,grammar_count,technical_count)}"
        )

    vocabulary: list[dict[str, Any]] = []
    for skeleton, explanation in zip(learning.get("vocabulary") or [], gv, strict=True):
        vocabulary.append(
            {
                "term": skeleton.get("term", ""),
                "reading": skeleton.get("reading", ""),
                "partOfSpeech": skeleton.get("partOfSpeech", ""),
                "meaning": str(explanation.get("meaning", "")).strip(),
                "level": skeleton.get("level", ""),
                "collocations": skeleton.get("collocations") or [],
                "note": str(explanation.get("note", "")).strip(),
                "exampleJa": skeleton.get("exampleJa", ""),
                "exampleMeaning": str(explanation.get("exampleMeaning", "")).strip(),
                "nuance": str(explanation.get("nuance", "")).strip(),
            }
        )

    grammar: list[dict[str, Any]] = []
    for skeleton, explanation in zip(learning.get("grammar") or [], gg, strict=True):
        grammar.append(
            {
                "pattern": skeleton.get("pattern", ""),
                "level": skeleton.get("level", ""),
                "meaning": str(explanation.get("meaning", "")).strip(),
                "structure": skeleton.get("structure", ""),
                "usage": str(explanation.get("usage", "")).strip(),
                "exampleJa": skeleton.get("exampleJa", ""),
                "exampleMeaning": str(explanation.get("exampleMeaning", "")).strip(),
                "note": str(explanation.get("note", "")).strip(),
            }
        )

    technical_terms: list[dict[str, Any]] = []
    for skeleton, explanation in zip(learning.get("technicalTerms") or [], gt, strict=True):
        item: dict[str, Any] = {
            "term": skeleton.get("term", ""),
            "meaning": str(explanation.get("meaning", "")).strip(),
            "context": str(explanation.get("context", "")).strip(),
        }
        if skeleton.get("japanese"):
            item["japanese"] = skeleton.get("japanese")
        technical_terms.append(item)

    frontmatter = {
        "title": f"日本語学習｜{context['date']}",
        "date": context["date"],
        "description": "当日のTop 5から抽出したJLPT語彙・文法とIT/AI日本語を、原文の技術文脈に沿って日本語で復習します。",
        "topics": learning.get("topics") or [],
        "levels": learning.get("levels") or [],
        "vocabularyCount": vocabulary_count,
        "grammarCount": grammar_count,
        "vocabulary": vocabulary,
        "grammar": grammar,
        "technicalTerms": technical_terms,
        "mustRememberWords": learning.get("mustRememberWords") or [],
        "mustRememberGrammar": learning.get("mustRememberGrammar") or [],
    }
    body = (
        "# C. 日本語学習｜JLPT + IT日本語\n\n"
        "当日のTop 5で実際に使われた表現と技術文脈を手掛かりに、語彙・文法・IT/AI用語を復習します。"
    )
    return dump_markdown(frontmatter, body)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--workdir", default="/tmp/source-direct-ja")
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--model", default="qwen3-4b")
    args = parser.parse_args()

    workdir = Path(args.workdir)
    context = json.loads((workdir / "source-context.json").read_text(encoding="utf-8"))
    if context.get("date") != args.date:
        raise RuntimeError("workdir context date does not match requested date")
    originals = load_originals(workdir)
    chat = LocalChat(args.base_url, args.model)

    daily = generate_daily(chat, context, originals)
    lesson = generate_lesson(chat, context, originals)

    (workdir / "daily-ja.md").write_text(daily, encoding="utf-8")
    (workdir / "japanese-ja.md").write_text(lesson, encoding="utf-8")
    print(f"daily bytes: {len(daily.encode('utf-8'))}", flush=True)
    print(f"lesson bytes: {len(lesson.encode('utf-8'))}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
