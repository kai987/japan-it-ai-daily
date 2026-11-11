---
title: 日本語学習｜2026年11月11日
date: '2026-11-11'
description: 要件へのなじみ、検査の不通過、相手に見せる動作を学びます。
topics:
- RAGの検索・回答の分離評価
- D1の実行計画と読み取り量
- YAMLフィクスチャの事前検査
- 縦動画の余白・字幕帯の検品
- Snowflakeのダッシュボード定義と権限
levels:
- N1
- N5/N4
- IT/AI
vocabularyCount: 3
grammarCount: 0
vocabulary:
- term: しっくり
  reading: しっくり
  level: N1
  partOfSpeech: 副詞
  collocations:
  - しっくり来る
  - しっくり合う
  - しっくりしない
  exampleJa: 今の画面は、毎朝数字を見る使い方にしっくり来ます。
  meaning: 物や考えがうまく合い、違和感がない様子。
  note: ダッシュボードの記事は、これまでの選択肢が利用目的に合わなかったと述べます。
  exampleMeaning: 今の画面の使い方が、毎朝の確認という目的に自然に合っています。
  nuance: 「ぴったり」は寸法や数量にも使います。「しっくり」は感じ方や関係のなじみのよさを表しやすい言葉です。
- term: 落ちる
  reading: おちる
  level: N5/N4
  partOfSpeech: 動詞・上一段・自動詞
  collocations:
  - 検査で落ちる
  - 試験に落ちる
  - 審査に落ちる
  exampleJa: 空の動画は、未計測として検査で落ちます。
  meaning: 合格とされず、次の段階へ進めない。
  note: 動画の記事は、測れない入力を合格させず失敗として扱います。
  exampleMeaning: 空の動画を読み取れなかったため、次の確認段階へは進めません。
  nuance: ここでは物が下へ移る意味ではなく、判定を通過しない用法です。参考レベルはN4です。
- term: 見せる
  reading: みせる
  level: N5/N4
  partOfSpeech: 動詞・下一段・他動詞
  collocations:
  - 数字を見せる
  - 根拠を見せる
  - 画面を見せる
  exampleJa: 権限を確かめてから、利用者に数字を見せます。
  meaning: 相手が目で見られるようにする。
  note: ダッシュボードの記事では、何を誰に見せるかと元データの権限が関係します。
  exampleMeaning: 利用者が参照してよいと確認してから、画面に数値を出します。
  nuance: 相手に見える状態を作る動作です。「表示する」は機械が画面へ出力する操作を述べる場合にも使います。参考レベルはN5です。
grammar: []
mustRememberWords:
- しっくり
- 落ちる
- 見せる
mustRememberGrammar: []
grammarSelectionNote: 五本の原文と全91日・117の既習文型を照合しました。「とは限らない」「に加えて」「からといって」などは既習で、独立した新規の用法と参考レベルを確認できる候補は残らず、新規は0項目です。本文で確認できる復習は別枠です。
technicalTerms:
- term: 根拠命中
  japanese: こんきょめいちゅう
  meaning: 回答に必要な記述が、渡した断片に含まれていること。
  context: RAGの回答の正否とは別に測ります。
- term: 相関サブクエリ
  japanese: そうかんサブクエリ
  meaning: 外側の行の値を使って条件を調べる部分問い合わせ。
  context: D1の例では利用者と記事を照合します。
- term: 一時Bツリー
  japanese: いちじビーツリー
  meaning: 並べ替えなどのため、一時的に使う木構造。
  context: D1の記事ではORDER BYの実行計画に現れました。
- term: JSON Schema
  japanese: ジェイソンスキーマ
  meaning: データの型や必須項目などの条件を記述する形式。
  context: yajsvでYAMLのテストデータを検査します。
- term: グレースケール
  japanese: 灰色の階調
  meaning: 画素を色ではなく明るさで表す方法。
  context: 動画の画素を固定サイズの生データとして受け取ります。
- term: UNMEASURED
  japanese: 未計測
  meaning: 必要な観測値が得られていない状態。
  context: フレームを一枚も取り出せない場合に使います。
- term: caller’s rights
  japanese: 呼び出し元の権限
  meaning: 処理を使う人自身のデータ権限で実行する方式。
  context: 共有ダッシュボードの各タイルで使われます。
---
