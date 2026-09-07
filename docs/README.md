# Documentation Index

日本 IT/AI 日報の品質・音声運用に関する主な仕様です。

- [`DAILY_CONTENT_QUALITY_RULES.md`](./DAILY_CONTENT_QUALITY_RULES.md) — Top 5 の分析深度、Section 3 面接 Q&A、技術アンカー、中日同期、推定朗読時間、CI 品質 Gate の全体ルール。
- [`INTERVIEW_AUDIO_DURATION_CALIBRATION.md`](./INTERVIEW_AUDIO_DURATION_CALIBRATION.md) — 約30秒回答の静的推定 → AivisSpeech → ffprobe 実 MP3 秒数 → manifest → R2 公開前 Gate の詳細。
- [`aivis-speech.md`](./aivis-speech.md) — AivisSpeech の生成・設定・運用手順。

品質ルールを変更する場合は、生成 Task の prompt、Validator、関連ドキュメントの三者が矛盾しないように更新します。
