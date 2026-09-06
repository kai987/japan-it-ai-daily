from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path


def load_base_module():
    path = Path(__file__).with_name("generate-source-direct-local.py")
    spec = importlib.util.spec_from_file_location("source_direct_base", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CappedChat:
    def __init__(self, base_chat, daily_tokens: int, lesson_tokens: int) -> None:
        self.base_chat = base_chat
        self.daily_tokens = daily_tokens
        self.lesson_tokens = lesson_tokens

    def ask(self, prompt: str, max_tokens: int) -> str:
        # The base generator currently asks for 6500 tokens for the daily body
        # and 6000 for the structured lesson JSON. Cap those requests so a
        # smaller local model can finish comfortably on GitHub-hosted CPU.
        if max_tokens >= 6500:
            capped = self.daily_tokens
        else:
            capped = self.lesson_tokens
        return self.base_chat.ask(prompt, max_tokens=capped)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True)
    parser.add_argument("--workdir", default="/tmp/source-direct-ja")
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--model", default="qwen3-1.7b")
    parser.add_argument("--daily-max-tokens", type=int, default=3600)
    parser.add_argument("--lesson-max-tokens", type=int, default=4400)
    args = parser.parse_args()

    base = load_base_module()
    workdir = Path(args.workdir)
    context = json.loads((workdir / "source-context.json").read_text(encoding="utf-8"))
    if context.get("date") != args.date:
        raise RuntimeError("workdir context date does not match requested date")

    originals = base.load_originals(workdir)
    raw_chat = base.LocalChat(args.base_url, args.model)
    # Lower randomness improves YAML/JSON stability on the smaller model.
    original_ask = raw_chat.ask

    def stable_ask(prompt: str, max_tokens: int) -> str:
        # LocalChat.ask owns the HTTP payload, so temporarily use its method.
        # The token cap itself is handled by CappedChat.
        return original_ask(prompt, max_tokens)

    raw_chat.ask = stable_ask
    chat = CappedChat(raw_chat, args.daily_max_tokens, args.lesson_max_tokens)

    daily = base.generate_daily(chat, context, originals)
    lesson = base.generate_lesson(chat, context, originals)

    (workdir / "daily-ja.md").write_text(daily, encoding="utf-8")
    (workdir / "japanese-ja.md").write_text(lesson, encoding="utf-8")
    print(f"daily bytes: {len(daily.encode('utf-8'))}", flush=True)
    print(f"lesson bytes: {len(lesson.encode('utf-8'))}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
