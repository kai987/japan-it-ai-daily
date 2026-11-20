---
title: 日本語学習｜2026年11月20日
date: '2026-11-20'
description: 作業の進め方を確認し、判断の理由を伝える語を学びます。
topics:
- 既存機能のAIDD改修
- AIツール呼び出しの事前認可
- モデル評価と費用
- Ubuntuパッチの先行提供
- ユーザー影響とSREリスク管理
levels:
- N1
- N2
- IT/AI
vocabularyCount: 4
grammarCount: 0
vocabulary:
- term: 遠回り
  reading: とおまわり
  level: N1
  partOfSpeech: 名詞・サ変
  collocations:
  - 遠回りになる
  - 遠回りをする
  exampleJa: 先に紙で試すのは遠回りに見えても、作り直す時間を減らせます。
  meaning: 目標までの道のりや手順が、直に進むときより長くなることです。
  note: AIとの確認が増えたとき、筆者は一見進みが遅くなると感じました。
  exampleMeaning: 最初に紙で試すと一手間かかるように思えても、後で作り直す時間は減ります。
  nuance: 道だけでなく進め方にも使えます。無駄だったとは限りません。
- term: 単一
  reading: たんいつ
  level: N1
  partOfSpeech: 形容動詞・名詞
  collocations:
  - 単一の方式
  - 単一の原因
  exampleJa: この画面では単一の条件で探し、複数条件の検索は別画面で行います。
  meaning: 種類や構成要素が一つであることです。
  note: 試作の段階では、一つのテーマを一つのカテゴリだけに所属させました。
  exampleMeaning: ここでは検索条件を一つにし、複数の条件で探すときは別の画面を使います。
  nuance: 「単純」は仕組みが複雑でないこと、「単一」は数や種類が一つであることに重点があります。
- term: 立ち止まる
  reading: たちどまる
  level: N2
  partOfSpeech: 五段・自動詞
  collocations:
  - その場で立ち止まる
  - 一度立ち止まって考える
  exampleJa: 意見がまとまらないときは、一度立ち止まって前提を確かめます。
  meaning: 進んでいた足や作業をその場所で止めることです。
  note: 筆者は途中で工程を見直し、飛ばされた手順を確認する人間の役割を挙げています。
  exampleMeaning: 意見が一致しないときはいったん作業を止め、何を前提にしているか調べます。
  nuance: 「休む」と違い、少し進行を止めて考える場面にも使います。
- term: 手順
  reading: てじゅん
  level: N1
  partOfSpeech: 名詞
  collocations:
  - 手順を踏む
  - 手順を見直す
  exampleJa: 受け付けから確認までの手順を、新しい担当者と一緒にたどりました。
  meaning: 作業を進める順番や、その順に行う具体的なやり方です。
  note: 切り戻しのやり方が整っていない場合を、リスクの書き方を示す架空の例にしています。
  exampleMeaning: 受付から確認まで何をどの順で行うか、新しい担当者と一通り見ました。
  nuance: 「順番」は並んでいる順序にも使えます。「手順」は作業の進め方に向きます。
grammar: []
mustRememberWords:
- 遠回り
- 単一
- 立ち止まる
- 手順
mustRememberGrammar: []
grammarSelectionNote: 今回は新規文法0件です。全100日分と照合し、「からといって」「に応じて」「だけでなく」などの既出用法は新規に加えず、本文復習と分けます。
technicalTerms:
- term: AIDD
  japanese: AI駆動開発
  meaning: 要求、設計、実装の工程でAIを併用する進め方です。
  context: 試作では要求分析の質問を人間が判断しました。
- term: Cedar
  japanese: シーダー
  meaning: 主体、操作、対象、条件を表す認可ポリシーの言語です。
  context: 今回の検証では実行前にグループと引数を評価しました。
- term: Coding Agent Index
  japanese: コーディングエージェント指標
  meaning: ツールを使うコーディング構成の評価指標です。
  context: CLIと推論設定をそろえない場合は構成ごとの比較として読みます。
- term: Backport
  japanese: バックポート
  meaning: 新しい版の修正を維持されている古い版に移すことです。
  context: Ubuntu Proの先行配布では候補を評価してから公開します。
- term: CUJ
  japanese: 重要なユーザー操作の流れ
  meaning: 利用者が目的を達成するために欠かせない一連の操作です。
  context: SmartHRの例は届出書類の作成と電子申請の送信です。
- term: System Risk Records
  japanese: システムのリスク記録
  meaning: 原因と起こりうる影響、対応の順位を共有する仕組みです。
  context: スコアに出にくい懸念は人が話し合って補いました。
---
