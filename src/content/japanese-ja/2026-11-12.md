---
title: 日本語学習｜2026年11月12日
date: '2026-11-12'
description: 計測の間隔、個数の増加、設定が元に戻る変化を学びます。
topics:
- 対話AIの応答言語の比較
- Workerのバッファ受け渡し
- スクロール連動アニメーション
- Tachyonのサンプリング計測
- 履歴データ訂正の丸め契約
levels:
- N2
- N5/N4
- IT/AI
vocabularyCount: 3
grammarCount: 0
vocabulary:
- term: 間隔
  reading: かんかく
  level: N2
  partOfSpeech: 名詞
  collocations:
  - 一定の間隔
  - 間隔を空ける
  - 計測間隔
  exampleJa: 一定の間隔でコールスタックを採取します。
  meaning: 二つのものや出来事の間の距離、または時間の空き。
  note: Tachyonは一定の間隔で実行中の情報を採ります。
  exampleMeaning: 前に採ってから決まった時間が過ぎるたびに、実行中の呼び出しの流れを記録します。
  nuance: 時間にも空間にも使えます。「頻度」は一定の期間内に何回起きるかという見方です。
- term: 増える
  reading: ふえる
  level: N5/N4
  partOfSpeech: 動詞・下一段・自動詞
  collocations:
  - 件数が増える
  - 負荷が増える
  - 記録が増える
  exampleJa: 小さな配列の個数が増えると、受け渡しの時間も変わります。
  meaning: 数や量が以前より多くなる。
  note: Workerの記事は配列の数が増える場合の受け渡し時間を測っています。
  exampleMeaning: 小さな配列が多くなると、送って受け取るのにかかる時間も変わります。
  nuance: 増えるものを主語にします。「増やす」は、数を多くする側の動作です。参考レベルはN4です。
- term: 戻る
  reading: もどる
  level: N5/N4
  partOfSpeech: 動詞・五段・自動詞
  collocations:
  - 元に戻る
  - 初期状態に戻る
  - 画面に戻る
  exampleJa: 一括指定のあと、タイムラインが初期状態に戻りました。
  meaning: 以前の場所や状態へ移る。
  note: CSSの記事は宣言順を変えるとタイムラインが時間基準に戻る例を示します。
  exampleMeaning: 一括指定が適用されて、タイムラインはもとの設定になりました。
  nuance: ここでは状態の変化を指します。「戻す」は状態を変える側の行為を表します。参考レベルはN4です。
grammar: []
mustRememberWords:
- 間隔
- 増える
- 戻る
mustRememberGrammar: []
grammarSelectionNote: 五本の原文と全92日・117の既習文型を照合しました。「に合わせて」「に加えて」「をもとに」などは既習で、独立した新規の用法と参考レベルを確認できる候補は残らず、新規は0項目です。本文で確認できる復習は別枠です。
technicalTerms:
- term: 会話の再生
  japanese: かいわのさいせい
  meaning: 保存した会話を途中から再開し、応答をもう一度生成する方法。
  context: 同じ地点で指示を変えて比べます。
- term: transfer list
  japanese: 転送リスト
  meaning: 受信側へ所有権を移す対象の一覧。
  context: Workerから返す大きなバッファを指定します。
- term: TypedArray
  japanese: 型付き配列
  meaning: バッファを一定の要素型で読み書きするビュー。
  context: 図面の座標などを格納します。
- term: ViewTimeline
  japanese: ビュー進行タイムライン
  meaning: スクロール領域に対する要素の位置で進む時間軸。
  context: カードの登場を表示位置に合わせます。
- term: pstats
  japanese: プロファイル統計
  meaning: 呼び出しや実行サンプルの集計を読むための形式。
  context: 行のdirectとcumulativeを比べます。
- term: wall-clock time
  japanese: 実経過時間
  meaning: 処理開始から終了まで、待ち時間も含む時間。
  context: CPUで実行した時間と分けて分析します。
- term: self-check
  japanese: 自己点検
  meaning: 反映する前に期待値を独立に求め、計画と照合する検査。
  context: 出来高が一株ずれた計画を止めました。
---
