from __future__ import annotations

import argparse
import importlib.util
import json
import re
from pathlib import Path
from typing import Any

import yaml


def load_base():
    path = Path(__file__).with_name("generate-source-direct-local.py")
    spec = importlib.util.spec_from_file_location("source_direct_base", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_json(base, chat, prompt: str, max_tokens: int) -> dict[str, Any]:
    raw = chat.ask(prompt, max_tokens=max_tokens)
    try:
        return base.extract_json(raw)
    except Exception:
        repair = (
            "次の内容を、意味を変えず有効なJSONオブジェクトだけに修正してください。"
            "説明・コードフェンスは禁止です。/no_think\n\n" + raw
        )
        return base.extract_json(chat.ask(repair, max_tokens=max_tokens))


def single_original(workdir: Path, index: int) -> str:
    return (workdir / "originals" / f"{index:02d}.txt").read_text(encoding="utf-8")


def article_cards(base, chat, context: dict[str, Any], workdir: Path) -> list[dict[str, str]]:
    base.load_originals(workdir)  # Fail closed before the first model request.
    cards: list[dict[str, str]] = []
    for index, item in enumerate(context["top"], 1):
        original = single_original(workdir, index)
        prompt = f"""
日本のIT/AI技術メディア向けに、次の1記事だけを、9月7日の日報と同等の詳しさで日本語で解説してください。中国語を経由せず、提供された原文だけを根拠にしてください。

記事メタデータ:
{json.dumps(item, ensure_ascii=False, indent=2)}

原文取得結果:
{original}

JSONだけを返してください:
{{"summary":"...","why":"..."}}

要件:
- summary: 短い要約に圧縮せず、背景、技術機構、実験条件、結果、制約を複数の段落で十分に展開する。
- 原文で確認できる設定名、比較条件、データ規模、測定値、例外、提供範囲を字数都合で落とさない。原文にない実験結果は作らず、「機能告知であり比較実験は未掲載」など不足の理由を明記する。
- 実測、提供者の主張、著者の推測、学習用の提案を区別する。一般化できない結論は適用条件付きで書き直す。
- why: 1文の「注目ポイント」。日本のIT/AIエンジニアや面接準備に何が役立つかを書く。
- 数字、製品名、モデル名、固有名詞は原文から確認できるものだけを使う。
- 原文が取得できていない場合は生成禁止。タイトルから本文を推測しない。
- 「中国語版」「翻訳」「機械翻訳」などの内部事情は書かない。
/no_think
""".strip()
        data = parse_json(base, chat, prompt, 3000)
        summary = str(data.get("summary") or "").strip()
        why = str(data.get("why") or "").strip()
        if not summary or not why:
            raise RuntimeError(f"Article {index}: empty source-based summary or why")
        cards.append({"summary": summary, "why": why})
    return cards


def synthesis(base, chat, context: dict[str, Any], cards: list[dict[str, str]]) -> dict[str, Any]:
    source = [
        {
            "title": item.get("title", ""),
            "source": item.get("source", ""),
            "topic": item.get("topic", ""),
            "summary": card["summary"],
            "why": card["why"],
        }
        for item, card in zip(context["top"], cards, strict=True)
    ]
    prompt = f"""
以下は、5本の原文を直接読んで作成済みの日本語要約です。この情報だけを使って、日本のIT/AI技術日報の横断セクションを作ってください。中国語版を想定したり翻訳したりしないでください。

SOURCE-DIRECT SUMMARIES:
{json.dumps(source, ensure_ascii=False, indent=2)}

JSONだけを返してください。形式:
{{
  "categorySummary": [{{"label":"AI","text":"..."}}],
  "interview": [{{"topic":"...","question":"...","answer":"...","project":"...","keywords":["...","...","..."]}}],
  "techTheme": {{"title":"...","overview":"...","merits":["..."],"limits":["..."],"japanNotes":["..."],"closing":"..."}},
  "reviewCards": [{{"question":"...","points":["..."]}}],
  "knowledge": [{{"title":"記事タイトル","points":["...","..."]}}]
}}

要件:
- categorySummaryはAI、Frontend、Cloud-Backend、日本企業 Tech Blogの4件。対象記事にない分野はその旨を簡潔に示し、未実施の網羅調査を主張しない。
- interviewは5件、元記事と同じ順序。質問は企業面接の形に広げても、各回答には当日のその記事に固有の技術点を1〜2個以上残す。
- 回答は「結論 → 記事の具体的な仕組み・条件 → その話題に合う実務判断」を自然な話し言葉でつなぐ。口頭約30秒を目安にし、製品/API名以外は分かりやすい日本語を優先する。
- 5問は異なる質問にする。「PoCだけで判断せず、実際のWorkloadで段階的に検証…」などの同じ結びを使い回さない。原文にない企業構成を実証済みの事実として追加しない。
- Frontend記事を汎用AI Coding論へ、学習基盤の記事を一般的なモデル選定論へ置き換えない。keywordsは各3個。
- techThemeは当日の5記事を横断する1テーマ。overviewは3〜6文、merits/limits/japanNotesは各2〜4点、closingは面接で使える1〜2文。
- reviewCardsは3問。
- knowledgeは必ず5件、SOURCE-DIRECT SUMMARIESと同じ順序・同じtitle。各pointsは2〜4点。
- 提供情報にない事実・数字を追加しない。
- 全文を自然な日本語で書く。
/no_think
""".strip()
    return parse_json(base, chat, prompt, 2100)


def render_daily(base, context: dict[str, Any], cards: list[dict[str, str]], syn: dict[str, Any]) -> str:
    lines: list[str] = ["# A. 詳細版", "", "## 1. 今日読むべき5本", ""]
    symbols = ["①", "②", "③", "④", "⑤"]
    for symbol, item, card in zip(symbols, context["top"], cards, strict=True):
        lines.extend([
            f"### {symbol} {item.get('title','')}",
            "",
            f"**出典：{item.get('source','')}**",
            "",
            f"**原文：** {item.get('url','')}",
            "",
            card["summary"],
            "",
            "**注目ポイント：★★★★★**", "", card["why"],
            "",
            "---",
            "",
        ])

    lines.extend(["## 2. カテゴリ別サマリー", ""])
    categories = syn.get("categorySummary") or []
    if not categories:
        categories = [{"label": "IT / AI", "text": "今日のTop 5を、実装・運用・評価の観点から横断的に確認できます。"}]
    for item in categories:
        lines.extend([f"### {str(item.get('label') or 'IT / AI').strip()}", "", str(item.get("text") or "").strip(), ""])

    lines.extend(["## 3. 面接で使えるポイント", ""])
    for i, item in enumerate((syn.get("interview") or [])[:5], 1):
        kws = [str(x).strip() for x in (item.get("keywords") or []) if str(x).strip()][:3]
        lines.extend([
            f"### 話題{i}：{str(item.get('topic') or '').strip()}",
            "",
            "**質問：**",
            "",
            f"> {str(item.get('question') or '').strip()}",
            "",
            "**30秒回答：**",
            "",
            f"> {str(item.get('answer') or '').strip()}",
            "",
            f"**関連Project：** {str(item.get('project') or '').strip()}",
            "",
            f"**キーワード：** {' / '.join(f'`{x}`' for x in kws)}",
            "",
        ])

    theme = syn.get("techTheme") or {}
    lines.extend([
        "## 4. 今日の技術テーマ",
        "",
        f"### {str(theme.get('title') or '今日のTop 5を横断する実装論点').strip()}",
        "",
        str(theme.get("overview") or "").strip(),
        "",
        "**メリット：**",
        "",
    ])
    for x in theme.get("merits") or []:
        lines.append(f"- {str(x).strip()}")
    lines.extend(["", "**制約・注意点：**", ""])
    for x in theme.get("limits") or []:
        lines.append(f"- {str(x).strip()}")
    lines.extend(["", "**日本企業での導入時の注意点：**", ""])
    for x in theme.get("japanNotes") or []:
        lines.append(f"- {str(x).strip()}")
    closing = str(theme.get("closing") or "").strip()
    if closing:
        lines.extend(["", "> " + closing, ""])

    lines.extend(["## 5. 面接復習カード", ""])
    for i, item in enumerate((syn.get("reviewCards") or [])[:3], 1):
        points = " / ".join(str(x).strip() for x in (item.get("points") or []) if str(x).strip())
        lines.extend([f"### Q{i}", "", f"> {str(item.get('question') or '').strip()}", "", f"**回答ポイント：** {points}", ""])

    lines.extend(["# B. 重要ポイントと面接で使える知識", ""])
    knowledge = syn.get("knowledge") or []
    for i, source_item in enumerate(context["top"]):
        item = knowledge[i] if i < len(knowledge) else {}
        lines.extend([f"## {i+1}. {source_item.get('title','')}", ""])
        points = item.get("points") or []
        if not points:
            points = [cards[i]["summary"]]
        for number, point in enumerate(points[:4], 1):
            lines.append(f"{number}. {str(point).strip()}")
        lines.append("")

    lines.extend([
        "# C. 日本語学習｜JLPT + IT日本語",
        "",
        "当日の記事の技術文脈に関連する語彙・文法・専門用語を復習します。例文は学習用であり、原文からの引用ではありません。面接回答と関連Projectは学習用の提案です。",
    ])

    body = "\n".join(lines).strip()
    top = []
    for src, card in zip(context["top"], cards, strict=True):
        entry = {
            "title": src.get("title", ""),
            "source": src.get("source", ""),
            **({"topic": src.get("topic")} if src.get("topic") else {}),
            "why": card["why"],
            **({"url": src.get("url")} if src.get("url") else {}),
        }
        top.append(entry)
    topics = context.get("topics") or []
    fm = {
        "title": f"日本 IT/AI 日報｜{int(context['date'][:4])}年{int(context['date'][5:7])}月{int(context['date'][8:])}日",
        "date": context["date"],
        "description": f"{context['date']}の日本IT・AI主要トピックを、原文に基づいて技術・面接・学習の観点から整理します。",
        "topics": topics,
        "sources": context.get("sources") or [],
        "top": top,
        "featured": bool(context.get("featured", False)),
        "interviewSource": "originals",
    }
    return base.dump_markdown(fm, body)


def explain_vocabulary(base, chat, learning: dict[str, Any], cards: list[dict[str, str]]) -> list[dict[str, Any]]:
    vocab = learning.get("vocabulary") or []
    results: list[dict[str, Any]] = []
    # Keep batches small enough for a 1.7B model to return valid JSON reliably.
    for start in range(0, len(vocab), 10):
        batch = vocab[start:start+10]
        prompt = f"""
次の日本語語彙を、日本語学習者向けに自然な日本語で説明してください。中国語から翻訳せず、日本語辞典のように直接説明してください。

今日の記事テーマ要約:
{json.dumps(cards, ensure_ascii=False)}

語彙（順序厳守）:
{json.dumps(batch, ensure_ascii=False, indent=2)}

JSONだけを返してください:
{{"items":[{{"meaning":"...","note":"...","exampleMeaning":"...","nuance":"..."}}]}}
itemsは必ず{len(batch)}件。同じ順序。
- meaning: 1文の簡潔な日本語定義。
- note: IT/AI記事やビジネス文での使い方を1文。根拠が薄い場合は一般的な用法に限定する。
- exampleMeaning: exampleJaを平易な日本語で言い換える。
- nuance: 近義語との差・語感・使用上の注意を1文。
/no_think
""".strip()
        data = parse_json(base, chat, prompt, 1250)
        items = data.get("items") or []
        if len(items) != len(batch):
            raise RuntimeError(f"vocabulary explanation count mismatch: {len(items)} != {len(batch)}")
        results.extend(items)
    return results


def explain_grammar_and_terms(base, chat, learning: dict[str, Any], cards: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    grammar = learning.get("grammar") or []
    terms = learning.get("technicalTerms") or []
    prompt = f"""
次のJLPT文法とIT/AI専門用語を、日本語学習者向けに自然な日本語で説明してください。中国語説明の翻訳は禁止です。

今日の記事テーマ要約:
{json.dumps(cards, ensure_ascii=False)}

文法（順序厳守）:
{json.dumps(grammar, ensure_ascii=False, indent=2)}

専門用語（順序厳守）:
{json.dumps(terms, ensure_ascii=False, indent=2)}

JSONだけを返してください:
{{
  "grammar":[{{"meaning":"...","usage":"...","exampleMeaning":"...","note":"..."}}],
  "technicalTerms":[{{"meaning":"...","context":"..."}}]
}}
grammarは必ず{len(grammar)}件、technicalTermsは必ず{len(terms)}件。同じ順序。
各説明は1〜2文で簡潔に。exampleMeaningはexampleJaの平易な日本語言い換え。確認できない記事固有事実は作らない。
/no_think
""".strip()
    data = parse_json(base, chat, prompt, 1900)
    g = data.get("grammar") or []
    t = data.get("technicalTerms") or []
    if len(g) != len(grammar) or len(t) != len(terms):
        raise RuntimeError(f"grammar/term count mismatch: {(len(g),len(t))} != {(len(grammar),len(terms))}")
    return g, t


def render_lesson(base, context: dict[str, Any], vexp: list[dict[str, Any]], gexp: list[dict[str, Any]], texp: list[dict[str, Any]]) -> str:
    learning = context["learning"]
    vocabulary = []
    for src, exp in zip(learning.get("vocabulary") or [], vexp, strict=True):
        vocabulary.append({
            "term": src.get("term", ""),
            "reading": src.get("reading", ""),
            "partOfSpeech": src.get("partOfSpeech", ""),
            "meaning": str(exp.get("meaning") or "").strip(),
            "level": src.get("level", ""),
            "collocations": src.get("collocations") or [],
            "note": str(exp.get("note") or "").strip(),
            "exampleJa": src.get("exampleJa", ""),
            "exampleMeaning": str(exp.get("exampleMeaning") or "").strip(),
            "nuance": str(exp.get("nuance") or "").strip(),
        })
    grammar = []
    for src, exp in zip(learning.get("grammar") or [], gexp, strict=True):
        grammar.append({
            "pattern": src.get("pattern", ""),
            "level": src.get("level", ""),
            "meaning": str(exp.get("meaning") or "").strip(),
            "structure": src.get("structure", "").replace("動詞ます形去ます", "動詞ます形から「ます」を取る"),
            "usage": str(exp.get("usage") or "").strip(),
            "exampleJa": src.get("exampleJa", ""),
            "exampleMeaning": str(exp.get("exampleMeaning") or "").strip(),
            "note": str(exp.get("note") or "").strip(),
        })
    terms = []
    for src, exp in zip(learning.get("technicalTerms") or [], texp, strict=True):
        item = {
            "term": src.get("term", ""),
            "meaning": str(exp.get("meaning") or "").strip(),
            "context": str(exp.get("context") or "").strip(),
        }
        if src.get("japanese"):
            item["japanese"] = src.get("japanese")
        terms.append(item)
    fm = {
        "title": f"日本語学習｜{int(context['date'][:4])}年{int(context['date'][5:7])}月{int(context['date'][8:])}日",
        "date": context["date"],
        "description": "当日の原文の技術文脈に関連する語彙・文法・IT/AI用語を日本語で復習します。",
        "topics": learning.get("topics") or [],
        "levels": learning.get("levels") or [],
        "vocabularyCount": len(vocabulary),
        "grammarCount": len(grammar),
        "vocabulary": vocabulary,
        "grammar": grammar,
        "technicalTerms": terms,
        "mustRememberWords": learning.get("mustRememberWords") or [],
        "mustRememberGrammar": learning.get("mustRememberGrammar") or [],
    }
    body = "# C. 日本語学習｜JLPT + IT日本語\n\n当日の原文を手掛かりに、日本語で説明を整理した学習カードです。例文は学習用であり、原文の引用ではありません。関連語には原文で直接扱われていない一般概念も含みます。JLPT 等級は学習上の目安です。"
    return base.dump_markdown(fm, body)


def render_learning_body(lesson: str) -> str:
    """Render the full C section using the September 7 Japanese daily layout."""
    data = yaml.safe_load(lesson.split("\n---\n", 1)[0][4:])
    lines = ["## C-1. JLPT語彙", ""]
    for i, item in enumerate(data["vocabulary"], 1):
        lines.extend([
            f"### {i}. {item['term']}（{item['reading']}）",
            f"**品詞：** {item['partOfSpeech']}｜**意味：** {item['meaning']}｜**目安：{item['level']}**  ",
            f"**コロケーション：** {' / '.join(item['collocations'])}  ",
            f"**文脈：** {item['note']}  ",
            f"**例：** `{item['exampleJa']}`  ",
            f"**ニュアンス：** {item['nuance']}", "",
        ])
    lines.extend(["## C-2. IT/AI専門語彙", ""])
    for i, item in enumerate(data["technicalTerms"], 1):
        label = item['term'] + ("｜" + item['japanese'] if item.get('japanese') else "")
        lines.extend([f"### {i}. {label}", f"**意味：** {item['meaning']}  ", f"**文脈：** {item['context']}", ""])
    lines.extend(["## C-3. JLPT文法", ""])
    for i, item in enumerate(data["grammar"], 1):
        lines.extend([
            f"### {i}. {item['pattern']}",
            f"**Level：{item['level']}｜意味：** {item['meaning']}  ",
            f"**形：** `{item['structure']}`  ",
            f"**使い方：** {item['usage']}  ",
            f"**例：** `{item['exampleJa']}`  ",
            f"**補足：** {item['note']}", "",
        ])
    lines.extend(["## C-4. 今日の必修", "", f"**10語：** {'・'.join(data['mustRememberWords'])}", "", f"**5文法：** {'・'.join(data['mustRememberGrammar'])}", ""])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--workdir", default="/tmp/source-direct-ja")
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--model", default="qwen3-1.7b")
    args = parser.parse_args()

    base = load_base()
    workdir = Path(args.workdir)
    context = json.loads((workdir / "source-context.json").read_text(encoding="utf-8"))
    if context.get("date") != args.date:
        raise RuntimeError("context date mismatch")
    chat = base.LocalChat(args.base_url, args.model)

    cards = article_cards(base, chat, context, workdir)
    syn = synthesis(base, chat, context, cards)
    daily = render_daily(base, context, cards, syn)

    vexp = explain_vocabulary(base, chat, context["learning"], cards)
    gexp, texp = explain_grammar_and_terms(base, chat, context["learning"], cards)
    lesson = render_lesson(base, context, vexp, gexp, texp)
    daily = daily.rstrip() + "\n\n" + render_learning_body(lesson)

    (workdir / "daily-ja.md").write_text(daily, encoding="utf-8")
    (workdir / "japanese-ja.md").write_text(lesson, encoding="utf-8")
    print(f"daily bytes: {len(daily.encode('utf-8'))}")
    print(f"lesson bytes: {len(lesson.encode('utf-8'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
