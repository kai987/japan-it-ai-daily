---
title: 日本語学習｜2026年11月10日
date: '2026-11-10'
description: 応答の到着、テストの通過、行を飛ばす操作を言葉にします。
topics:
- 日本語判定モデルの評価
- ミューテーションテスト
- RSC と画面遷移
- SQLAlchemy の候補投影
- CAD メッシュ変換
levels:
- N5/N4
- N3
- IT/AI
vocabularyCount: 3
grammarCount: 0
vocabulary:
- term: 届く
  reading: とどく
  level: N3
  partOfSpeech: 動詞・五段・自動詞
  collocations:
  - 応答が届く
  - 通知が届く
  - 端末に届く
  exampleJa: 最初の応答が届いたら、読み込み中の表示を出します。
  meaning: 送られた物や情報が行き先に着く。
  note: 画面遷移の記事では、必要な応答がブラウザーへ届く時点が重要です。
  exampleMeaning: 端末に最初の応答が到着してから、読み込み中だと示します。
  nuance: 主語は到着する情報です。「受け取る」はそれを受け取る側の動作を表します。
- term: 通る
  reading: とおる
  level: N5/N4
  partOfSpeech: 動詞・五段・自動詞
  collocations:
  - テストが通る
  - 審査が通る
  - 申請が通る
  exampleJa: 古い実装でもテストが通るので、境界の値を検証し直します。
  meaning: 求められる条件を満たして先へ進める。
  note: 変異を入れてもテストが通る場合、期待値を見直す手掛かりになります。
  exampleMeaning: 変更前の実装でも合格になるため、境界そのものの値をもう一度調べます。
  nuance: テスト自体が成功したことを述べます。対象の仕様をすべて満たすとまでは言っていません。参考レベルはN4です。
- term: 飛ばす
  reading: とばす
  level: N3
  partOfSpeech: 動詞・五段・他動詞
  collocations:
  - 行を飛ばす
  - 手順を飛ばす
  - 一段飛ばす
  exampleJa: 削除された行を飛ばし、残りは選んだ順に表示します。
  meaning: 順番に並んだものの途中を抜いて先へ進む。
  note: 関連記事の記事では、二回目の読み取り前に消えた行を飛ばします。
  exampleMeaning: 消えていた行を処理せず、その後に残る行を選んだときの順番で出します。
  nuance: 操作の流れで一つ先に進む言い方です。「省略する」は説明や記述を省く場面にもよく使います。
grammar: []
mustRememberWords:
- 届く
- 通る
- 飛ばす
mustRememberGrammar: []
grammarSelectionNote: 五本の原文と全90日・117の既習文型を照合しました。「とは限らない」「ずに済む」「にとどまる」などは既習で、独立した新規の用法と参考レベルを確認できる候補は残らず、新規は0項目です。本文で確認できる復習は別枠です。
technicalTerms:
- term: ECE
  japanese: 期待較正誤差
  meaning: 確率帯ごとに自信と実際の正しさのずれを集計する指標。
  context: 判定モデルは別のデータで悪化する例がありました。
- term: 変異体
  japanese: ミュータント
  meaning: 元のコードに一か所ずつ小さな変更を加えたもの。
  context: 比較演算を変えた後、テストが失敗するかを調べます。
- term: RSC payload
  japanese: サーバーコンポーネントの出力
  meaning: サーバーで作ったコンポーネントの結果と、クライアント側への参照を表すデータ。
  context: ブラウザーが画面を切り替えるときに使います。
- term: Row
  japanese: クエリ結果の一行
  meaning: 選んだ列を一行ずつ受け取る結果型。
  context: SQLAlchemyでは判定の段階で完全なモデルを生成せずに済みます。
- term: B-rep
  japanese: 境界表現
  meaning: 曲面や辺などの境界で立体を表す方法。
  context: 拡張から穴の円筒と三角形の対応を調べます。
- term: 弦のたわみ
  japanese: 円弧と弦の離れ
  meaning: 弧を直線で近似したときの最大の離れ。
  context: 板の穴で線形許容差と分割数の影響を比較しました。
---
