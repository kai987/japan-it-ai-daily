---
title: 日语学习｜2026年11月22日
date: '2026-11-22'
description: 学习说明步数、图表颜色、词汇集合，以及与说明一致的表达。
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
  meaningZh: 完成一件事所需的操作步数。
  noteZh: 为比较推理强度，作者换成需要多个步骤才能解的文字题。
  exampleZh: 同一个问题，整理好中间式就能用较少步骤求出答案。
  nuanceZh: 「手間」也包含时间和精力。这里的「手数」强调操作步数。
- term: 灰色
  reading: はいいろ
  level: N2
  partOfSpeech: 名詞
  collocations:
  - 灰色の線
  - 灰色の表示
  - 灰色で示す
  exampleJa: 先月とった値は、今月の実測値と区別できるように灰色で示します。
  meaningZh: 灰一样的颜色，介于黑白之间。
  noteZh: 图中把作为对照的两个模型历史数据画成灰色。
  exampleZh: 上月的测量值用灰色表示，以便和本月实测值区分。
  nuanceZh: 原文指颜色。也可比喻判定尚不明确。
- term: 語彙
  reading: ごい
  level: N1
  partOfSpeech: 名詞
  collocations:
  - 語彙を増やす
  - 語彙の制約
  - 専門分野の語彙
  exampleJa: 出力に使える語彙を限定すると、分類結果の表記を統一しやすくなります。
  meaningZh: 某种语言、领域或某人所用词语的集合。
  noteZh: 日本语试题中包含对可用词语的限制。
  exampleZh: 如果限制输出可用的词汇，就更容易统一分类结果的写法。
  nuanceZh: 「単語」可指单个词，「語彙」强调由词组成的集合。
- term: 大方
  reading: おおかた
  level: N1
  partOfSpeech: 副詞・名詞
  collocations:
  - 大方は終わる
  - 大方片付く
  - 大方の予想
  exampleJa: 必要な一覧は大方そろいましたが、権限の確認だけが残っています。
  meaningZh: 大部分，也可指做到了大体上的程度。
  noteZh: 作者判断自己的大多数 Python 读取工作用这一方式即可完成。
  exampleZh: 所需清单基本齐备，还剩权限待核对。
  nuanceZh: 留下有少量例外的余地，表达大部分已解决。
grammar:
- pattern: 〜とおり（に）
  level: N3
  sourceUrl: https://dev.classmethod.jp/articles/20211121-amazon-dynamodb-vector-filters/
  sourceForm: ドキュメントのとおり
  sourceAnchor: は、ドキュメントのとおり
  exampleJa: 説明書のとおりに入力すると、結果が表の二行目と一致します。
  meaningZh: 表示和指定步骤、描述或预期一致。
  structure: 名詞＋の＋とおり（に）／動詞の辞書形またはた形＋とおり（に）／名詞＋どおり（に）
  usageZh: 原文用它表示上下界相同的范围查询结果与文档的描述一致。
  exampleZh: 按照说明书输入，结果会与表格第二行一致。
  noteZh: 「に従って」常指遵守规则或指令，「とおり」突出做法或结果与给出的样式相符。参考 Bunpro N3。
mustRememberWords:
- 手数
- 灰色
- 語彙
- 大方
mustRememberGrammar:
- 〜とおり（に）
grammarSelectionNote: 查对全102期后，新学语法收录「とおり」1项。「によって」「に応じて」等已有记录，供正文复习。
technicalTerms:
- term: MoE
  japanese: 専門家混合
  meaningZh: 按输入选择模型的一部分专家执行。
  contextZh: 原文分别列出总参数量和活动参数。
- term: SearchVectors
  japanese: ベクトル検索API
  meaningZh: 查询相似度较高的嵌入。
  contextZh: 在检索中应用价格筛选。
- term: Invariant
  japanese: 不変条件
  meaningZh: 状态变化中也应成立的约束。
  contextZh: 示例核对已售数量是否超出初始库存。
- term: Acceptance criteria
  japanese: 受け入れ基準
  meaningZh: 用户端可以观察到的完成条件。
  contextZh: 示例区分对外行为和内部组织规则。
- term: s3fs
  japanese: PythonからのS3ファイル読み込み
  meaningZh: 让 Python 程序读取 S3 对象。
  contextZh: 作者直接给 pandas 传入 S3 URI。
---
