from __future__ import annotations

import argparse
import os
import re
from pathlib import Path
from typing import Any, Iterable

import langid
import torch
import yaml
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

MODEL_NAME = "Helsinki-NLP/opus-mt-tc-big-zh-ja"

ROOT = Path(__file__).resolve().parents[1]
DAILY_SRC = ROOT / "src/content/daily"
DAILY_DST = ROOT / "src/content/daily-ja"
LESSON_SRC = ROOT / "src/content/japanese"
LESSON_DST = ROOT / "src/content/japanese-ja"

KNOWN_LINES = {
    "# A. 详细文字版": "# A. 詳細版",
    "## 1. 今日最值得看的 5 篇": "## 1. 今日読むべき5本",
    "## 2. 分类速览": "## 2. カテゴリ別サマリー",
    "## 3. 面接で使えるポイント": "## 3. 面接で使えるポイント",
    "## 4. 今日の技術テーマ": "## 4. 今日の技術テーマ",
    "## 5. 面试复习卡": "## 5. 面接復習カード",
    "# B. 重点总结和面试可用的知识点｜重要ポイントと面接で使える知識": "# B. 重要ポイントと面接で使える知識",
    "# C. 日本語学习｜JLPT + IT日本語": "# C. 日本語学習｜JLPT + IT日本語",
    "## C-1. JLPT词汇": "## C-1. JLPT語彙",
    "## C-2. IT/AI专业词汇": "## C-2. IT/AI専門用語",
    "## C-3. JLPT语法": "## C-3. JLPT文法",
    "## C-4. 今日必背": "## C-4. 今日の必修",
}

LABEL_PREFIXES = [
    ("**来源：", "**出典："),
    ("**为什么值得看：", "**注目ポイント："),
    ("**面试问题：**", "**面接質問：**"),
    ("**面試問題：**", "**面接質問：**"),
    ("**约30秒回答：**", "**約30秒の回答：**"),
    ("**約30秒回答：**", "**約30秒の回答：**"),
    ("**可关联项目：**", "**関連プロジェクト：**"),
    ("**可關聯項目：**", "**関連プロジェクト：**"),
    ("**3 个关键词：**", "**3つのキーワード：**"),
    ("**3個のキーワード：**", "**3つのキーワード：**"),
    ("**回答要点：**", "**回答ポイント：**"),
    ("**回答要點：**", "**回答ポイント：**"),
    ("回答要点：", "回答ポイント："),
    ("回答要點：", "回答ポイント："),
    ("**partOfSpeech：**", "**品詞：**"),
    ("**meaningZh：**", "**意味：**"),
    ("**level：**", "**レベル：**"),
    ("**collocations：**", "**よく使う組み合わせ：**"),
    ("**noteZh：**", "**記事文脈：**"),
    ("**exampleJa：**", "**日本語例文：**"),
    ("**exampleZh：**", "**例文の意味：**"),
    ("**nuanceZh：**", "**ニュアンス：**"),
    ("**japanese：**", "**日本語：**"),
    ("**contextZh：**", "**記事文脈：**"),
    ("**structure：**", "**構造：**"),
    ("**usageZh：**", "**使用場面：**"),
    ("**10词：**", "**10語：**"),
    ("**10詞：**", "**10語：**"),
    ("**5语法：**", "**5文法：**"),
    ("**5語法：**", "**5文法：**"),
]

FINAL_REPLACEMENTS = {
    "回答要点：": "回答ポイント：",
    "回答要點：": "回答ポイント：",
    "为什么值得看": "注目ポイント",
    "為什麼值得看": "注目ポイント",
    "面试问题": "面接質問",
    "面試問題": "面接質問",
    "面试复习卡": "面接復習カード",
    "面試復習卡": "面接復習カード",
    "日本語学习": "日本語学習",
    "JLPT词汇": "JLPT語彙",
    "JLPT詞彙": "JLPT語彙",
    "专业词汇": "専門用語",
    "專業詞彙": "専門用語",
    "JLPT语法": "JLPT文法",
    "JLPT語法": "JLPT文法",
    "今日必背": "今日の必修",
}

ZH_SIGNALS = set(
    "这为与从个们对让把还现应进过里并将该较仅时种后会发开关问题报见务动说读写认语词汇习间图门长达连选适远类级员资质责财费预领顾题额风飞马验驱编约线组终给结统经续绿网联职药获营蓝观览视觉计论设访证评识诉诊译诚询详误请调谈谱负账货购贵贷赔赖赚赠赞转轮软轻载辑输边迁运迟递遗邻释鉴问闻闭闹阅险随隐难雾静页顺饮饭馆鲜鸟鸣齐齿龙"
)

PROTECT_RE = re.compile(r"(`[^`\n]+`|https?://[^\s)>]+|\$\{[^}]+\})")
KANA_RE = re.compile(r"[ぁ-んァ-ヴー々〆ヶ]")
HAN_RE = re.compile(r"[\u3400-\u9fff]")
CODE_FENCE_RE = re.compile(r"^\s*```")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[。！？!?；;])")
MARKDOWN_PREFIX_RE = re.compile(r"^(\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)?)(.*)$")


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        raise ValueError("Markdown file has no YAML frontmatter")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("Markdown frontmatter is not terminated")
    data = yaml.safe_load(text[4:end]) or {}
    body = text[end + 5 :]
    return data, body


def dump_frontmatter(data: dict[str, Any], body: str) -> str:
    dumped = yaml.safe_dump(
        data,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=1000,
    ).rstrip()
    return f"---\n{dumped}\n---\n\n{body.lstrip()}"


def plain_for_language(text: str) -> str:
    value = PROTECT_RE.sub(" ", text)
    value = re.sub(r"[*_>#\[\](){}|]", " ", value)
    value = re.sub(r"[A-Za-z0-9_./:+-]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def needs_translation(text: str) -> bool:
    value = plain_for_language(text)
    if not value or not HAN_RE.search(value):
        return False
    if any(ch in ZH_SIGNALS for ch in value):
        return True
    if KANA_RE.search(value):
        return False
    lang, _score = langid.classify(value)
    return lang == "zh"


def split_long_text(text: str, max_chars: int = 260) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    pieces = [piece for piece in SENTENCE_SPLIT_RE.split(text) if piece]
    chunks: list[str] = []
    current = ""
    for piece in pieces:
        subpieces = re.split(r"(?<=[，、,])", piece) if len(piece) > max_chars else [piece]
        for sub in subpieces:
            if current and len(current) + len(sub) > max_chars:
                chunks.append(current)
                current = sub
            else:
                current += sub
    if current:
        chunks.append(current)
    return chunks or [text]


def translation_chunks(texts: Iterable[str]) -> list[str]:
    chunks: list[str] = []
    for text in texts:
        if not text or not needs_translation(text):
            continue
        chunks.extend(chunk for chunk in split_long_text(text) if needs_translation(chunk))
    return list(dict.fromkeys(chunks))


class Translator:
    def __init__(self) -> None:
        print(f"Loading translation model: {MODEL_NAME}", flush=True)
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=False)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            MODEL_NAME,
            trust_remote_code=False,
            use_safetensors=True,
            dtype=torch.float32,
        )
        self.model.eval()
        torch.set_num_threads(max(1, min(4, os.cpu_count() or 2)))
        self.cache: dict[str, str] = {}

    @staticmethod
    def _protect(text: str) -> tuple[str, dict[str, str]]:
        mapping: dict[str, str] = {}

        def repl(match: re.Match[str]) -> str:
            key = f"ZXQPH{len(mapping)}QXZ"
            mapping[key] = match.group(0)
            return key

        return PROTECT_RE.sub(repl, text), mapping

    @staticmethod
    def _restore(text: str, mapping: dict[str, str]) -> str:
        restored = text
        for key, value in mapping.items():
            loose = re.compile(r"\s*" + re.escape(key) + r"\s*")
            if key in restored:
                restored = restored.replace(key, value)
            elif loose.search(restored):
                restored = loose.sub(value, restored)
            else:
                restored = f"{restored.rstrip()} {value}"
        return restored

    def translate_batch(self, texts: list[str], batch_size: int = 32) -> list[str]:
        missing = list(dict.fromkeys(text for text in texts if text and text not in self.cache))
        if not missing:
            return [self.cache.get(text, text) for text in texts]

        for start in range(0, len(missing), batch_size):
            raw_batch = missing[start : start + batch_size]
            protected_batch: list[str] = []
            mappings: list[dict[str, str]] = []
            for raw in raw_batch:
                protected, mapping = self._protect(raw)
                protected_batch.append(protected)
                mappings.append(mapping)

            encoded = self.tokenizer(
                protected_batch,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=384,
            )
            with torch.inference_mode():
                generated = self.model.generate(
                    **encoded,
                    max_new_tokens=384,
                    num_beams=1,
                )
            decoded = self.tokenizer.batch_decode(generated, skip_special_tokens=True)
            for raw, translated, mapping in zip(raw_batch, decoded, mappings, strict=True):
                self.cache[raw] = self._restore(translated.strip(), mapping)
            print(f"Translated {min(start + batch_size, len(missing))}/{len(missing)} batched segments", flush=True)
        return [self.cache.get(text, text) for text in texts]

    def prefill(self, texts: Iterable[str]) -> None:
        self.translate_batch(translation_chunks(texts))

    def translate_text(self, text: str) -> str:
        if not text or not needs_translation(text):
            return text
        chunks = split_long_text(text)
        todo = [chunk for chunk in chunks if needs_translation(chunk) and chunk not in self.cache]
        if todo:
            self.translate_batch(todo)
        return "".join(self.cache.get(chunk, chunk) for chunk in chunks)


def line_translation_target(line: str) -> str | None:
    stripped = line.strip()
    if not stripped or stripped in KNOWN_LINES:
        return None

    if stripped.startswith("### 话题") or stripped.startswith("### 話題"):
        match = re.match(r"^(\s*###\s+)(?:话题|話題)(\s*\d+\s*[：:]?\s*)(.*)$", line)
        return match.group(3) if match else None

    for old, _new in LABEL_PREFIXES:
        index = line.find(old)
        if index >= 0:
            return line[index + len(old) :]

    if not needs_translation(line):
        return None
    match = MARKDOWN_PREFIX_RE.match(line)
    return match.group(2) if match else line


def translate_markdown_line(line: str, translator: Translator) -> str:
    stripped = line.strip()
    if stripped in KNOWN_LINES:
        leading = line[: len(line) - len(line.lstrip())]
        return leading + KNOWN_LINES[stripped]

    if stripped.startswith("### 话题") or stripped.startswith("### 話題"):
        match = re.match(r"^(\s*###\s+)(?:话题|話題)(\s*\d+\s*[：:]?\s*)(.*)$", line)
        if match:
            prefix, number, title = match.groups()
            return f"{prefix}テーマ {number.strip().rstrip('：:')}：{translator.translate_text(title)}"

    for old, new in LABEL_PREFIXES:
        index = line.find(old)
        if index >= 0:
            before = line[:index]
            tail = line[index + len(old) :]
            return f"{before}{new}{translator.translate_text(tail)}"

    if not needs_translation(line):
        return line

    match = MARKDOWN_PREFIX_RE.match(line)
    if not match:
        return translator.translate_text(line)
    prefix, content = match.groups()
    return prefix + translator.translate_text(content)


def translate_body(body: str, translator: Translator) -> str:
    lines = body.splitlines()
    targets: list[str] = []
    in_code = False
    for line in lines:
        if CODE_FENCE_RE.match(line):
            in_code = not in_code
            continue
        if in_code:
            continue
        target = line_translation_target(line)
        if target:
            targets.append(target)
    translator.prefill(targets)

    output: list[str] = []
    in_code = False
    for line in lines:
        if CODE_FENCE_RE.match(line):
            in_code = not in_code
            output.append(line)
            continue
        if in_code:
            output.append(line)
            continue
        output.append(translate_markdown_line(line, translator))

    result = "\n".join(output).rstrip() + "\n"
    for old, new in FINAL_REPLACEMENTS.items():
        result = result.replace(old, new)
    return result


def translate_daily_file(src: Path, dst: Path, translator: Translator) -> None:
    data, body = parse_frontmatter(src.read_text(encoding="utf-8"))
    candidates = [str(data.get("title", "")), str(data.get("description", ""))]
    for item in data.get("top", []) or []:
        candidates.append(str(item.get("title", "")))
        if item.get("why") is not None:
            candidates.append(str(item.get("why", "")))
    translator.prefill(candidates)

    out = dict(data)
    out["title"] = translator.translate_text(str(data.get("title", ""))).replace("日报", "日報").replace("日報｜", "日報｜")
    out["description"] = translator.translate_text(str(data.get("description", "")))
    top = []
    for item in data.get("top", []) or []:
        translated = dict(item)
        translated["title"] = translator.translate_text(str(item.get("title", "")))
        if item.get("why") is not None:
            translated["why"] = translator.translate_text(str(item.get("why", "")))
        top.append(translated)
    out["top"] = top

    ja_body = translate_body(body, translator)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(dump_frontmatter(out, ja_body), encoding="utf-8")


def lesson_translation_candidates(data: dict[str, Any]) -> list[str]:
    candidates = [str(data.get("title", "")), str(data.get("description", ""))]
    for item in data.get("vocabulary", []) or []:
        for key in ("meaningZh", "noteZh", "exampleZh", "nuanceZh"):
            if item.get(key):
                candidates.append(str(item[key]))
    for item in data.get("grammar", []) or []:
        for key in ("meaningZh", "usageZh", "exampleZh", "noteZh"):
            if item.get(key):
                candidates.append(str(item[key]))
    for item in data.get("technicalTerms", []) or []:
        for key in ("meaningZh", "contextZh"):
            if item.get(key):
                candidates.append(str(item[key]))
    return candidates


def translate_lesson_file(src: Path, dst: Path, translator: Translator) -> None:
    data, _body = parse_frontmatter(src.read_text(encoding="utf-8"))
    translator.prefill(lesson_translation_candidates(data))

    out: dict[str, Any] = {
        "title": translator.translate_text(str(data.get("title", ""))).replace("日本語学习", "日本語学習"),
        "date": data.get("date"),
        "description": translator.translate_text(str(data.get("description", ""))),
        "topics": data.get("topics", []),
        "levels": data.get("levels", []),
        "vocabularyCount": data.get("vocabularyCount", 0),
        "grammarCount": data.get("grammarCount", 0),
        "vocabulary": [],
        "grammar": [],
        "technicalTerms": [],
        "mustRememberWords": data.get("mustRememberWords", []),
        "mustRememberGrammar": data.get("mustRememberGrammar", []),
    }

    for item in data.get("vocabulary", []) or []:
        out["vocabulary"].append({
            "term": item.get("term", ""),
            "reading": item.get("reading", ""),
            "partOfSpeech": item.get("partOfSpeech", ""),
            "meaning": translator.translate_text(str(item.get("meaningZh", ""))),
            "level": item.get("level", "IT/AI"),
            "collocations": item.get("collocations", []),
            "note": translator.translate_text(str(item.get("noteZh", ""))),
            "exampleJa": item.get("exampleJa", ""),
            **({"exampleMeaning": translator.translate_text(str(item.get("exampleZh")))} if item.get("exampleZh") else {}),
            **({"nuance": translator.translate_text(str(item.get("nuanceZh")))} if item.get("nuanceZh") else {}),
        })

    for item in data.get("grammar", []) or []:
        out["grammar"].append({
            "pattern": item.get("pattern", ""),
            "level": item.get("level", "IT/AI"),
            "meaning": translator.translate_text(str(item.get("meaningZh", ""))),
            "structure": item.get("structure", ""),
            "usage": translator.translate_text(str(item.get("usageZh", ""))),
            "exampleJa": item.get("exampleJa", ""),
            **({"exampleMeaning": translator.translate_text(str(item.get("exampleZh")))} if item.get("exampleZh") else {}),
            **({"note": translator.translate_text(str(item.get("noteZh")))} if item.get("noteZh") else {}),
        })

    for item in data.get("technicalTerms", []) or []:
        out["technicalTerms"].append({
            "term": item.get("term", ""),
            **({"japanese": item.get("japanese")} if item.get("japanese") else {}),
            "meaning": translator.translate_text(str(item.get("meaningZh", ""))),
            "context": translator.translate_text(str(item.get("contextZh", ""))),
        })

    body = "# C. 日本語学習｜JLPT + IT日本語\n\n当日のTop 5から抽出したJLPT語彙・文法とIT / AI日本語を、技術文脈とあわせて復習します。\n"
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(dump_frontmatter(out, body), encoding="utf-8")


def validate_output(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    forbidden = [
        "详细文字版", "今日最值得看的", "分类速览", "面试复习卡", "重点总结", "日本語学习",
        "JLPT词汇", "专业词汇", "JLPT语法", "今日必背", "为什么值得看", "面试问题",
        "约30秒回答", "可关联项目", "回答要点", "meaningZh", "noteZh", "exampleZh",
        "nuanceZh", "contextZh", "usageZh",
    ]
    hits = [needle for needle in forbidden if needle in text]
    if hits:
        raise RuntimeError(f"{path}: untranslated structural labels remain: {hits}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dates", nargs="*", default=[])
    args = parser.parse_args()
    selected = set(args.dates)

    translator = Translator()
    daily_files = sorted(DAILY_SRC.glob("*.md"))
    lesson_files = sorted(LESSON_SRC.glob("*.md"))
    if selected:
        daily_files = [path for path in daily_files if path.stem in selected]
        lesson_files = [path for path in lesson_files if path.stem in selected]

    for index, src in enumerate(daily_files, 1):
        print(f"[{index}/{len(daily_files)}] Daily: {src.name}", flush=True)
        dst = DAILY_DST / src.name
        translate_daily_file(src, dst, translator)
        validate_output(dst)

    for index, src in enumerate(lesson_files, 1):
        print(f"[{index}/{len(lesson_files)}] Japanese lesson: {src.name}", flush=True)
        dst = LESSON_DST / src.name
        translate_lesson_file(src, dst, translator)
        validate_output(dst)

    print(f"Generated {len(daily_files)} Japanese daily files and {len(lesson_files)} Japanese learning files.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
