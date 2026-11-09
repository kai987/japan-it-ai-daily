---
title: 日本語学習｜2026年11月9日
date: '2026-11-09'
description: 作業環境の空きと、処理後に残る情報を表す言い方を学びます。
topics:
- 根拠付きウェブ調査
- 並列開発の資源競合
- ファイアウォールの評価順序
- メトリクスのクエリ互換
- 多言語のテキスト処理
levels:
- N5/N4
- N3
- IT/AI
vocabularyCount: 2
grammarCount: 0
vocabulary:
- term: 空く
  reading: あく
  level: N3
  partOfSpeech: 動詞・五段・自動詞
  collocations:
  - ポートが空く
  - 席が空く
  - 時間が空く
  exampleJa: テスト用のポートが空いてから、開発サーバーを起動します。
  meaning: 使われていた場所や時間などが、使える状態になる。
  note: 並列開発の記事では、使われていないポートをフックが案内します。
  exampleMeaning: テスト用のポートが使える状態になったら、開発サーバーを立ち上げます。
  nuance: 「ポートが空く」は利用可能になること。「ポートを空ける」では人が利用状態を変えることを表します。
- term: 残る
  reading: のこる
  level: N5/N4
  partOfSpeech: 動詞・五段・自動詞
  collocations:
  - ログに残る
  - 出典が残る
  - 記録が残る
  exampleJa: ツールの出力をまとめ直した後も、元の記事へのリンクが残るか確かめます。
  meaning: 処理や変化があった後も、その場にある。
  note: Web Answerの記事では、出典が最終回答にそのまま残るとは限りません。
  exampleMeaning: ツールの文章を書き直した後も、元のページに行けるか確認します。
  nuance: 自然に残った結果を表す自動詞です。意識して保存する動作なら「出典を残す」を使います。参考レベルはN4です。
grammar: []
mustRememberWords:
- 空く
- 残る
mustRememberGrammar: []
grammarSelectionNote: 全89日・117の既習文型を五本の原文と照合しました。「をもとに」「とは限らない」などは既習です。出典の文脈と参考レベルが確認できる未収録文型を特定できず、新規は0項目です。復習は別枠で扱います。
technicalTerms:
- term: MCP
  japanese: モデルと外部ツールを接続するプロトコル
  meaning: ツールの発見と呼び出しの共通仕様。
  context: AgentCore GatewayはWeb Answerを呼び出せるツールとして公開します。
- term: PreToolUse
  japanese: ツール実行前のフック
  meaning: 実行直前に入力を調べられる拡張点。
  context: 並列セッションの命令と共有資源の競合を実行前に確かめます。
- term: TLS SNI
  japanese: TLS接続時に示すサーバー名
  meaning: クライアントがTLSの接続開始時に伝えるサーバー名。
  context: 実験ではHTTPSのドメイン判定に使います。
- term: OTLP
  japanese: OpenTelemetry Protocol
  meaning: 観測データを送るためのプロトコル。
  context: EKSからCloudWatchにカウンターを送る経路で使います。
- term: SigV4
  japanese: AWS署名バージョン4
  meaning: AWS APIリクエストを認証する署名方式。
  context: GrafanaのデータソースからCloudWatchを呼ぶ際に使います。
- term: Set
  japanese: 集合
  meaning: 同じ値を一つとして扱うデータ構造。
  context: kilnは階層と正規化テキストから作ったキーを照合します。
---
