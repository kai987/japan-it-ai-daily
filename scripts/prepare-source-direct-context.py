from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import requests
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]


def parse_frontmatter(path: Path) -> dict:
    # Stop at the closing delimiter; never load the Chinese Markdown body.
    with path.open(encoding="utf-8") as stream:
        if stream.readline().strip() != "---":
            raise RuntimeError(f"{path}: missing frontmatter")
        lines = []
        for line in stream:
            if line.strip() == "---":
                return yaml.safe_load("".join(lines)) or {}
            lines.append(line)
    raise RuntimeError(f"{path}: unterminated frontmatter")


def make_context(date: str) -> dict:
    daily = parse_frontmatter(ROOT / "src/content/daily" / f"{date}.md")
    lesson = parse_frontmatter(ROOT / "src/content/japanese" / f"{date}.md")
    top = daily.get("top") or []
    if len(top) != 5:
        raise RuntimeError(f"{date}: expected exactly five Top items, got {len(top)}")

    # Deliberately export only factual identity/metadata. Chinese summaries and
    # explanatory prose are never exposed to the Japanese generator.
    return {
        "date": date,
        "topics": daily.get("topics") or [],
        "sources": daily.get("sources") or [],
        "featured": bool(daily.get("featured", False)),
        "top": [
            {
                "index": index + 1,
                "title": item.get("title", ""),
                "source": item.get("source", ""),
                "topic": item.get("topic", ""),
                "url": item.get("url", ""),
            }
            for index, item in enumerate(top)
        ],
        "learning": {
            "topics": lesson.get("topics") or [],
            "levels": lesson.get("levels") or [],
            "vocabularyCount": lesson.get("vocabularyCount", 0),
            "grammarCount": lesson.get("grammarCount", 0),
            "vocabulary": [
                {
                    "term": item.get("term", ""),
                    "reading": item.get("reading", ""),
                    "partOfSpeech": item.get("partOfSpeech", ""),
                    "level": item.get("level", ""),
                    "collocations": item.get("collocations") or [],
                    "exampleJa": item.get("exampleJa", ""),
                }
                for item in (lesson.get("vocabulary") or [])
            ],
            "grammar": [
                {
                    "pattern": item.get("pattern", ""),
                    "level": item.get("level", ""),
                    "structure": item.get("structure", ""),
                    "exampleJa": item.get("exampleJa", ""),
                }
                for item in (lesson.get("grammar") or [])
            ],
            "technicalTerms": [
                {
                    "term": item.get("term", ""),
                    **({"japanese": item.get("japanese")} if item.get("japanese") else {}),
                }
                for item in (lesson.get("technicalTerms") or [])
            ],
            "mustRememberWords": lesson.get("mustRememberWords") or [],
            "mustRememberGrammar": lesson.get("mustRememberGrammar") or [],
        },
    }


def fetch_originals(context: dict, workdir: Path, max_chars: int) -> None:
    originals_dir = workdir / "originals"
    originals_dir.mkdir(parents=True, exist_ok=True)
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
        "Accept-Language": "ja,en;q=0.8",
    }

    for index, item in enumerate(context["top"], 1):
        url = item.get("url") or ""
        output = originals_dir / f"{index:02d}.txt"
        if not url:
            output.write_text("FETCH_STATUS: missing URL\n", encoding="utf-8")
            continue
        try:
            response = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
            response.raise_for_status()
            if not response.encoding or response.encoding.lower() == "iso-8859-1":
                response.encoding = response.apparent_encoding or "utf-8"
            soup = BeautifulSoup(response.text, "html.parser")
            for tag in soup(["script", "style", "noscript", "svg", "form", "nav", "footer", "header", "aside"]):
                tag.decompose()
            root = soup.find("article") or soup.find("main") or soup.body or soup
            text = re.sub(r"\n{3,}", "\n\n", root.get_text("\n", strip=True))
            if len(text) < 300:
                raise RuntimeError("original article text is too short")
            if len(text) > max_chars:
                raise RuntimeError(f"article exceeds {max_chars} chars; increase --article-chars")
            output.write_text(
                f"URL: {response.url}\nHTTP_STATUS: {response.status_code}\n"
                f"SOURCE_TITLE: {item.get('title', '')}\n\n{text}\n",
                encoding="utf-8",
            )
            print(f"{index}: fetched {len(text)} chars from {response.url}", flush=True)
        except Exception as exc:
            output.write_text(
                f"URL: {url}\nSOURCE_TITLE: {item.get('title', '')}\n"
                f"FETCH_STATUS: failed\nERROR: {exc}\n",
                encoding="utf-8",
            )
            print(f"WARNING: article {index} fetch failed: {exc}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--workdir", default="/tmp/source-direct-ja")
    parser.add_argument("--article-chars", type=int, default=90000)
    args = parser.parse_args()

    workdir = Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    context = make_context(args.date)
    (workdir / "source-context.json").write_text(
        json.dumps(context, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    fetch_originals(context, workdir, args.article_chars)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
