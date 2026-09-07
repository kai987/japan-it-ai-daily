# Daily Content Quality Rules

このドキュメントは、日本 IT/AI 日報の **生成品質・面接 Q&A 品質・中日同期・自動検証・公開条件** を一か所で確認できるようにまとめた運用ルールです。

> 運用開始日: **2026-09-08**
>
> 目的: 毎日の生成モデルに依存せず、できるだけ GPT-5.6 Sol 相当の分析深度を安定して維持する。

---

## 1. 基本方針

日報は単なるニュース要約ではなく、次の 4 つを同時に満たすことを目標とします。

1. **原文に忠実であること**
2. **技術的に十分な深さがあること**
3. **日本の IT / AI 面接で再利用できること**
4. **日本語学習素材としても利用できること**

最重要なのは、文章を「それらしく詳しく」することではなく、**原文に存在する具体的な仕組み・数値・実験条件・制約・技術判断を残したまま、企業エンジニアの視点へ引き上げること**です。

---

## 2. Source of Truth

当日の Top 5 について、以下を原文から確定します。

- title
- source
- topic
- URL
- 製品名 / サービス名 / Framework 名
- 数値
- 実験条件
- 評価結果
- 制約
- 原文上の技術判断

これらの **原始記事を唯一の Source of Truth** とします。

### 中国語モードと日本語モード

- 中国語モードと日本語モードは、原則としてそれぞれ原文から独立生成する。
- 中国語 Markdown 全体を日本語へ機械翻訳しない。
- 日本語稿を中国語へ逆翻訳しない。
- 日本語モードは、可能な限り原文の自然な日本語の用語と語感を使う。

例外は Section 3 の面接 Q&A だけです。これは後述の通り、両モードで完全に共通化します。

---

## 3. Top 5 詳細解説の品質基準

各記事は「2〜3 句の短い要約」で終わらせず、少なくとも次の観点を含めます。

### 必須観点

- 背景 / 課題
- 仕組み / Mechanism
- 具体的な API・Feature・Architecture・Tool・Command など
- 実験 / Benchmark / Vendor 発表 / 公式仕様など、証拠の種類
- 数値や条件がある場合はその条件
- 結果
- 制約・反例・適用範囲・未検証点
- なぜ面接で使えるのか

### 自動品質ゲート

`scripts/validate-daily-quality.mjs` では、2026-09-08 以降の各 Top 5 解説について、以下を検査します。

- 5 本すべて存在すること
- 中国語版 / 日本語版ともに各記事 **430 文字以上（空白除外）**
- 各記事 **2 個以上の実質段落**
- 制約・条件・証拠境界に相当する記述が存在すること
- Evidence / Measurement / Comparison の手がかりがない場合は警告を出すこと

430 文字は「詳しければよい」という意味ではなく、極端に短い概要を防ぐための最低ラインです。

---

## 4. Section 3 面接 Q&A の固定ルール

## 4.1 Top 5 と 1 対 1 に対応

Top 5 各記事について、必ず 1 組ずつ Q&A を作成します。

- Top 1 → Q&A 1
- Top 2 → Q&A 2
- Top 3 → Q&A 3
- Top 4 → Q&A 4
- Top 5 → Q&A 5

したがって、Section 3 は **必ず 5 組**です。

---

## 4.2 質問は企業面接レベルまで引き上げてよい

質問は原文の内容をそのまま聞く必要はありません。

たとえば次のように、企業の設計・運用判断に引き上げても構いません。

- 本番導入なら何を評価するか
- 運用でどう検証するか
- どのような条件で採用判断するか
- Trade-off をどう説明するか
- 失敗時に何を確認するか

ただし、**質問と回答の中心テーマは必ず元記事に残す**こと。

記事と関係の薄い一般的な「AI System 運用論」へ置き換えるのは禁止です。

---

## 4.3 30 秒回答は記事固有の技術点を残す

各 30 秒回答には、少なくとも **1〜2 個の、その記事固有かつ原文で確認できる技術点**を含めます。

推奨する技術アンカーの例:

- API / Function / Feature 名
- Framework / Product / Service 名
- Command / Hook / Event
- Architecture / Retrieval 方法
- 実験条件
- 数値
- Version
- 制約
- 特有の評価方法

### 良い構造

```text
結論・判断
  ↓
原文中の具体的技術点 1〜2 個
  ↓
企業環境での検証・選択基準
```

### 禁止するパターン

```text
PoC だけで判断せず、実 Workload で評価することが重要です。
```

このような一般論だけで終わる回答は不可です。

文章の一部として使うこと自体は問題ありませんが、**それだけで回答を構成してはいけません**。

---

## 4.4 30 秒回答の長さ

自動検証では、回答本文を空白除外で次の範囲に設定します。

- 最低: **90 文字**
- 最大: **260 文字**

目的は、短すぎる箇条書き回答と、30 秒を大きく超える長文の両方を防ぐことです。

---

## 4.5 制約・実験境界を残す

元記事に以下がある場合、回答側にも可能な限り 1 つは残します。

- 単発測定
- 1 条件 1 回のみ
- Vendor Benchmark
- Alpha / Preview
- 特定 Workload 限定
- 特定 Repository 限定
- 未対応機能
- 再現性未確認
- Cost / TCO が未比較

単一記事の結果を一般化しないことが重要です。

---

## 4.6 テンプレート化の禁止

5 個の回答は、それぞれ異なる論点と技術アンカーを持つ必要があります。

自動検証では以下を確認します。

- 完全に同じ長文 Sentence が複数回答で再利用されていないか
- 回答同士の語彙 Jaccard 類似度が高すぎないか

現在の失敗閾値:

- **類似度 0.68 以上 → FAIL**

また、以下のような英語一般語を「専門的に見せるためだけ」に大量使用しないこと。

- Request
- Model
- Token
- Latency
- Dashboard
- Workload
- Cost
- Quality

必要な場合は使用してよいですが、**記事固有の技術用語を優先**します。

---

## 5. 中日 Q&A 完全同期

Section 3 の `質問 + 30秒回答` は、日中両モードで同一文字列を使います。

canonical shared text は中国語モード側に置き、日本語モードでは逐字コピーします。

次の項目は完全一致が必要です。

- 数量
- 順序
- 質問文
- 回答文
- 数字
- 技術固有名詞
- 句読点

### なぜ exact match が必要か

AivisSpeech の `interview-manifest.json` はテキストを厳密一致で音声へ対応付けるため、日中両モードで同一 Q&A を使用する必要があります。

チェックコマンド:

```bash
npm run bilingual:check-interview
```

実装:

```text
scripts/sync-bilingual-interview.mjs
```

---

## 6. 自動品質ゲート

実装ファイル:

```text
scripts/validate-daily-quality.mjs
```

通常チェック:

```bash
npm run quality:check
```

当日だけチェック:

```bash
npm run quality:check:latest
```

### 主な FAIL 条件

- Top 5 が 5 本ではない
- 日中どちらかの詳細解説が不足
- 詳細解説が 430 文字未満
- 実質段落が 2 個未満
- 制約 / 条件 / Evidence Boundary がない
- Section 3 が 5 組ではない
- 30 秒回答が 90〜260 文字の範囲外
- 対応記事との独有技術アンカーが 2 個未満
- 記事に制約があるのに Q&A に制約 / 検証条件がない
- 複数回答で同一テンプレート文を再利用
- 回答同士の類似度が 0.68 以上

### 技術アンカーの判定

Validator は Top 5 各記事から単語・製品名・英数字・数値などを抽出し、5 記事の中でその記事だけに現れる Token を **unique article anchors** として扱います。

回答側に、その記事の unique anchor が最低 2 個存在することを確認します。

これは完全な意味理解ではありませんが、**一般論だけの回答を機械的に弾くための最低限の品質ゲート**として機能します。

---

## 7. CI / Deploy での強制実行

GitHub Pages の正式公開前に、次の順で検査します。

```text
Type Check
  ↓
Bilingual Interview Q&A Check
  ↓
Daily Content Quality Check
  ↓
Audio Script Check
  ↓
Tests
  ↓
Astro Build
  ↓
CSP Check
  ↓
Deploy
```

正式 Deploy Workflow:

```text
.github/workflows/deploy.yml
```

通常 CI / Security Workflow:

```text
.github/workflows/security-check.yml
```

品質チェックに失敗した場合、GitHub Pages の公開処理を続行しません。

---

## 8. 四つの同期対象ファイル

毎日、以下の 4 ファイルを同じ日付で整合させます。

```text
src/content/daily/YYYY-MM-DD.md
src/content/japanese/YYYY-MM-DD.md
src/content/daily-ja/YYYY-MM-DD.md
src/content/japanese-ja/YYYY-MM-DD.md
```

### daily

中国語モードの完全な A + B + C。

### japanese

中国語モード向け Structured Japanese Learning Data。

### daily-ja

自然な日本語で再構成した完全な A + B + C。

Section 3 の Q&A だけは `daily` と exact match。

### japanese-ja

日本語モード向け Structured Japanese Learning Data。

語彙・文法の identity は中国語側と対応させ、説明フィールドは自然な日本語で記述します。

---

## 9. 日本語学習 C セクション

Top 5 からのみ抽出します。

### JLPT 語彙

- 18〜22 個
- 目標約 20
- N1 / N2 優先
- 名詞に偏らせない
- 動詞 5〜7 程度
- 形容詞 2〜3 程度
- 副詞 2〜3 程度
- 接続詞 / 慣用表現なども含める

### IT / AI 専門語彙

- 5〜10 個

### JLPT 文法

- 5〜8 個
- N1 / N2 中心
- 当日の記事文脈と接続

### 今日必背

- Vocabulary 10 個
- Grammar 5 個

---

## 10. 人間による最終判断

自動 Gate は品質の最低ラインを保証するためのものです。

以下は機械チェックだけでは完全に判定できません。

- 原文の意味を正しく理解しているか
- 技術判断が妥当か
- 数字を誤って一般化していないか
- Interview Answer が自然な日本語か
- 実際の日本企業面接で使いやすいか
- 記事の重要なポイントを取り違えていないか

そのため、最終的には次の問いで判断します。

> **記事タイトルを隠した状態でも、この回答が多数の AI 記事へそのまま使い回せるなら、具体性不足として書き直す。**

逆に、回答を聞くだけで元記事の技術テーマや特徴がある程度分かるなら、望ましい状態です。

---

## 11. 運用上の優先順位

品質判断の優先順位は次の通りです。

1. 原文事実の正確性
2. 数字・条件・Evidence Boundary の正確性
3. Top 5 と Q&A の対応
4. 記事固有技術点の保持
5. 企業面接としての実用性
6. 自然な日本語
7. 中日表示の一貫性
8. 文章量

**文字数を増やすために未確認情報を追加することは禁止**します。

情報が少ない公式 Announcement の場合は、無理に実験結果を補わず、

- 何が確認できるか
- 何が確認できないか
- 何を追加検証すべきか

を明確に分けます。

---

## 12. 関連ファイル

```text
scripts/validate-daily-quality.mjs
scripts/sync-bilingual-interview.mjs
package.json
.github/workflows/deploy.yml
.github/workflows/security-check.yml
```

この文書は人間向けの運用仕様です。

**実際に Deploy を止める最終的な機械判定は `scripts/validate-daily-quality.mjs` と CI Workflow が Source of Truth です。**
