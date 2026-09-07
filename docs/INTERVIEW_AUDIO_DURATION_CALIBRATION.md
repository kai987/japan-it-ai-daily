# Interview Audio Duration Calibration

この文書は、Section 3 の「約30秒回答」について、**生成前の推定時間**と**生成後の実 MP3 時間**を二段階で検証する仕組みを説明します。

## 1. 目的

文字数だけでは、日本語・英語技術用語・略語・数字・句読点を含む回答の朗読時間を正確に表せません。

そのため、30 秒回答は次の二段階で検証します。

```text
共有日本語 Q&A
  ↓
静的推定（CI / 日報品質 Gate）
  ↓
AivisSpeech 生成
  ↓
ffprobe による実 MP3 秒数
  ↓
interview-manifest.json に保存
  ↓
R2 同期前に再検証
```

## 2. 時間帯

現在の共通ポリシー:

- 理想: **26〜34 秒**
- 許容: **22〜40 秒**
- 22 秒未満 / 40 秒超: **FAIL**
- 22〜40 秒内だが 26〜34 秒外: **WARN**

ポリシーの強制開始日は `2026-09-08` です。過去音声は backfill 可能ですが、過去の日報をこの新しい基準だけで失敗扱いにはしません。

## 3. 生成前: 推定朗読時間

`scripts/validate-daily-quality.mjs` が共有日本語回答の推定朗読時間を計算します。

推定は以下を別々に重み付けします。

- ひらがな / カタカナ
- 漢字
- 英語技術用語
- AI / MCP / BM25 のような略語
- 数字 / 百分率
- 句読点による pause
- `AIVIS_INTERVIEW_SPEED`
- pre / post phoneme length

これは AivisSpeech を CI 上で起動せずに、明らかに短すぎる / 長すぎる回答を事前に止めるための近似です。

## 4. 生成後: 実 MP3 秒数

`scripts/validate-interview-audio-duration.mjs` が `ffprobe` を使って MP3 の実際の duration を取得します。

標準音声生成コマンドは、AivisSpeech の生成後にこのスクリプトを自動実行します。

```bash
npm run audio:generate
npm run audio:generate:latest
npm run audio:generate:all
npm run audio:generate:all:force
npm run audio:generate:interview:latest
npm run audio:generate:interview:all
npm run audio:generate:interview:all:force
```

生成済み音声を単独で測定する場合:

```bash
npm run audio:duration:write:latest
```

既存の全 manifest を backfill する場合:

```bash
npm run audio:duration:backfill
```

## 5. Manifest fields

実測後、各 audio item に次の情報を保存します。

```json
{
  "audio": "interview-answer-01.mp3",
  "durationSeconds": 30.742,
  "durationStatus": "ideal"
}
```

30 秒回答の `durationStatus`:

- `ideal`: 26〜34 秒
- `warn`: 22〜40 秒だが理想帯の外
- `fail`: 22〜40 秒の硬い許容範囲外
- `legacy`: 2026-09-08 より前の音声

Manifest 全体にも使用したポリシーを保存します。

```json
{
  "durationPolicy": {
    "source": "ffprobe",
    "enforceFrom": "2026-09-08",
    "idealSeconds": [26, 34],
    "hardSeconds": [22, 40],
    "maxStoredDriftSeconds": 0.08
  },
  "durationMeasuredAt": "..."
}
```

質問音声や復習カード音声も `durationSeconds` は記録しますが、30 秒回答の hard range は `type: answer` に対して適用します。

## 6. R2 公開前の最終 Gate

`.github/workflows/sync-r2-audio.yml` は Cloudflare R2 へ同期する前に次を実行します。

1. Node.js を準備
2. `ffprobe` を確認。なければ ffmpeg を導入
3. `npm run audio:duration:check`
4. 実 MP3 と manifest の duration を再照合
5. duration Gate が成功した場合のみ R2 へ同期

これにより、標準生成コマンドを使わずに MP3 が追加された場合でも、R2 公開前に最終確認できます。

## 7. Stored duration drift

`audio:duration:check` は、manifest に保存された `durationSeconds` と現在の `ffprobe` 実測値を比較します。

現在の許容差:

```text
0.08 秒
```

これを超える場合は、音声ファイルと manifest が一致していない可能性があるため FAIL します。

環境変数:

```text
INTERVIEW_DURATION_MAX_STORED_DRIFT
```

## 8. Threshold environment variables

推定時間と実測時間は同じ基本閾値を使います。

```text
INTERVIEW_DURATION_IDEAL_MIN=26
INTERVIEW_DURATION_IDEAL_MAX=34
INTERVIEW_DURATION_HARD_MIN=22
INTERVIEW_DURATION_HARD_MAX=40
AIVIS_INTERVIEW_SPEED=1.00
```

実 MP3 Gate の強制開始日:

```text
INTERVIEW_ACTUAL_DURATION_FROM=2026-09-08
```

## 9. 関連ファイル

```text
scripts/validate-daily-quality.mjs
scripts/validate-interview-audio-duration.mjs
scripts/generate-interview-audio.mjs
public/audio/japanese/YYYY-MM-DD/interview-manifest.json
.github/workflows/sync-r2-audio.yml
package.json
```

## 10. 判定の優先順位

30 秒回答は以下の順で判断します。

1. 原文事実・技術内容が正しい
2. 記事固有の技術アンカーを保持している
3. 日本語として自然で面接で話しやすい
4. 推定朗読時間が適切
5. AivisSpeech 実 MP3 時間が適切

**実測音声を短くするために重要な技術内容を削るのではなく、重複表現や冗長な一般論を削って調整する**ことを原則とします。
