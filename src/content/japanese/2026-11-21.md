---
title: 日语学习｜2026年11月21日
date: '2026-11-21'
description: 学习说明金额合计、交互操作与停止处理的日语词汇。
topics:
- レシートOCRの比較
- Lambdaの分散トレース
- Sparkバッチの余剰容量
- Icebergテーブルの書き込み切替
- 内部ALBのDNS切替
levels:
- N3
- N1
- N2
- IT/AI
vocabularyCount: 3
grammarCount: 0
vocabulary:
- term: 合計
  reading: ごうけい
  level: N3
  partOfSpeech: 名詞・サ変動詞
  collocations:
  - 合計を出す
  - 合計金額
  - 費用を合計する
  exampleJa: 読み取った金額を合計して、レシートに印字された額と比べます。
  meaningZh: 把多笔数字相加得到总数，也可指进行相加。
  noteZh: 原文将小票总额是否识别正确，与依品目复算能否通过分别计分。
  exampleZh: 将识别出的金额相加，再和小票上印的金额核对。
  nuanceZh: 「集計」还包括分类汇总和计数，「合計」突出加总。
- term: 対話
  reading: たいわ
  level: N1
  partOfSpeech: 名詞・サ変動詞
  collocations:
  - 対話を続ける
  - 対話の場
  - 対話セッション
  exampleJa: 対話セッションでは前の実行結果を見ながら、次の処理をその場で選べます。
  meaningZh: 交换信息，并根据对方的回应继续进行。
  noteZh: 原文说 Flex 不支持可在连接中一边执行一边查看响应的交互会话。
  exampleZh: 在交互会话中，可以看着上一条执行结果，当场选下一步操作。
  nuanceZh: 「会話」常指日常交谈，「対話」突出回应往来，也可说人与系统的交互。
- term: 停止
  reading: ていし
  level: N2
  partOfSpeech: 名詞・サ変動詞
  collocations:
  - 書き込みを停止する
  - 一時停止
  - 処理を停止する
  exampleJa: 切り替えの直前に書き込みを停止し、コピーの完了を待ちます。
  meaningZh: 正在运行的服务、进程或动作停下，或让它停下。
  noteZh: 解除副本关联后，来自旧源表的复制处理随即停止。
  exampleZh: 切换前先停写，再等复制完成。
  nuanceZh: 「中止」可指打消原定计划。「停止」着眼于正在运转的过程停下来，能否恢复取决于语境。
grammar: []
mustRememberWords:
- 合計
- 対話
- 停止
mustRememberGrammar: []
grammarSelectionNote: 本期新学语法为0项。查对全101期后，原文的「によって」「に合わせて」等用法已有收录，供正文复习。
technicalTerms:
- term: OCR
  japanese: 光学文字認識
  meaningZh: 把图像里的文字转换为文本。
  contextZh: 原文分别统计商品名正确率和金额召回率。
- term: Attempt span
  japanese: 試行単位のスパン
  meaningZh: 表示某步骤的一次执行尝试。
  contextZh: 测试中的成功重试与第一次失败可分别查看。
- term: Flex execution
  japanese: 余剰容量を使うジョブ実行
  meaningZh: 用闲置资源运行 Spark 执行器。
  contextZh: 作者把同一聚合作业用 Standard 和 Flex 并行运行。
- term: metadataLocation
  japanese: メタデータの格納先
  meaningZh: 指向描述表状态的元数据。
  contextZh: 切换前用它确认目标的最后一次复制更新和源端一致。
- term: Private Endpoint Health Checks
  japanese: プライベートエンドポイントのヘルスチェック
  meaningZh: 监测 VPC 内端点是否健康。
  contextZh: 东京的测试将内部 ALB 检查结果供 DNS 切换使用。
---
