---
title: 日本語学習｜2026年11月22日
date: '2026-11-22'
description: 手順の多さ、図の色、語の集まり、説明との一致を表す言い方を学びます。
topics:
- 手元でのマルチモーダル推論
- ベクトル検索のインライン絞り込み
- モデルに基づく同時実行テスト
- 振る舞いに基づく受け入れテスト
- NotebookからのS3直接読み込み
levels:
- N1
- N2
- IT/AI
vocabularyCount: 4
grammarCount: 1
vocabulary:
- term: 手数
  reading: てかず
  level: N1
  partOfSpeech: 名詞
  collocations:
  - 手数がかかる
  - 手数を減らす
  - 少ない手数で解く
  exampleJa: 同じ問題でも、途中式を整理すると少ない手数で答えを出せます。
  meaning: 何かを行うために必要な操作や手順の数です。
  note: 思考の強さを比べるため、一手で解けない文章題に変更しました。
  exampleMeaning: 途中の計算をまとめると、少ない操作で解けます。
  nuance: 「手間」は時間や労力も含みます。「手数」は操作や手順の多さに着目する用法です。
- term: 灰色
  reading: はいいろ
  level: N2
  partOfSpeech: 名詞
  collocations:
  - 灰色の線
  - 灰色の表示
  - 灰色で示す
  exampleJa: 先月とった値は、今月の実測値と区別できるように灰色で示します。
  meaning: 灰のような、黒と白の中間の色です。
  note: 図では比較のために載せた過去の二つのモデルを灰色で示しています。
  exampleMeaning: 先月の値は今月と混同しないように色を変えて描きます。
  nuance: 色についての用法です。「灰色の判定」などでは結論がはっきりしないことを比喩的に表せます。
- term: 語彙
  reading: ごい
  level: N1
  partOfSpeech: 名詞
  collocations:
  - 語彙を増やす
  - 語彙の制約
  - 専門分野の語彙
  exampleJa: 出力に使える語彙を限定すると、分類結果の表記を統一しやすくなります。
  meaning: ある言語、分野、または人が使う語の集まりです。
  note: 日本語の問題には、使える語を制限する条件を含むものがありました。
  exampleMeaning: 出力で選べる語を決めると、同じ分類名にそろえやすくなります。
  nuance: 「単語」は一語ずつを指すときに使えます。「語彙」はそれらのまとまりに着目します。
- term: 大方
  reading: おおかた
  level: N1
  partOfSpeech: 副詞・名詞
  collocations:
  - 大方は終わる
  - 大方片付く
  - 大方の予想
  exampleJa: 必要な一覧は大方そろいましたが、権限の確認だけが残っています。
  meaning: 全体のうち大きな部分を指します。文脈によって「おおむね」に近くなります。
  note: 筆者は普段のPython作業の多くを、この読み方でまかなえそうだと見ています。
  exampleMeaning: 必要な一覧はほぼそろい、権限の確認が残っています。
  nuance: 「全部」まで済んだと言い切らず、残りがあっても大部分は片付いたという見立てを伝えます。
grammar:
- pattern: 〜とおり（に）
  level: N3
  sourceUrl: https://dev.classmethod.jp/articles/20211121-amazon-dynamodb-vector-filters/
  sourceForm: ドキュメントのとおり
  sourceAnchor: は、ドキュメントのとおり
  exampleJa: 説明書のとおりに入力すると、結果が表の二行目と一致します。
  meaning: ある手順、説明、予想などと同じであることを表します。
  structure: 名詞＋の＋とおり（に）／動詞の辞書形またはた形＋とおり（に）／名詞＋どおり（に）
  usage: 原文では、上下の値を同じにした範囲指定の結果が、文書の記述と一致することを表します。
  exampleMeaning: 説明書に書かれたやり方で入力すれば、表の二行目と同じ結果になります。
  note: 「に従って」は規則や指示を守る行為にも使います。「とおり」はやり方や結果が示された形と一致する点を強調します。参考レベルはBunproのN3。
mustRememberWords:
- 手数
- 灰色
- 語彙
- 大方
mustRememberGrammar:
- 〜とおり（に）
grammarSelectionNote: 全102日分と照合し、新規文法は「とおり」の1件です。「によって」「に応じて」は既出のため、本文復習に分けます。
technicalTerms:
- term: MoE
  japanese: 専門家混合
  meaning: 入力に応じて一部の専門家を選ぶ設計です。
  context: モデルの総パラメータ数とトークンごとに使う量に差があります。
- term: SearchVectors
  japanese: ベクトル検索API
  meaning: 近い埋め込みの候補を探します。
  context: 検索の途中で価格の条件を適用しました。
- term: Invariant
  japanese: 不変条件
  meaning: 状態が変わっても満たすべき条件です。
  context: 販売枚数が初期在庫を超えないことを確かめます。
- term: Acceptance criteria
  japanese: 受け入れ基準
  meaning: 利用者から確認できる完了の条件です。
  context: 内部の部品の構成を条件から分けました。
- term: s3fs
  japanese: PythonからのS3ファイル読み込み
  meaning: PythonのコードからS3オブジェクトを読みます。
  context: 記事ではpandasにS3のURIを渡しました。
---
