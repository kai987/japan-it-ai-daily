---
title: 日语学习｜2026年11月10日
date: '2026-11-10'
description: 练习描述响应到达、测试通过与跳过记录。
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
  meaningZh: 传送的物品或信息到达目的地。
  noteZh: 前端文章关注载荷何时到达浏览器。
  exampleZh: 第一批响应到达后，显示加载中的界面。
  nuanceZh: 到达的信息作主语。「受け取る」从接收方的动作描述同一过程。
- term: 通る
  reading: とおる
  level: N5/N4
  partOfSpeech: 動詞・五段・自動詞
  collocations:
  - テストが通る
  - 審査が通る
  - 申請が通る
  exampleJa: 古い実装でもテストが通るので、境界の値を検証し直します。
  meaningZh: 满足规定条件而通过。
  noteZh: 原文用测试通过来描述变异未被断言发现。
  exampleZh: 旧实现也能通过测试，所以重新验证边界上的取值。
  nuanceZh: 说明检查结果通过。「通す」以使某物通过的行动者为主语。参考为N4，站内归入N5/N4。
- term: 飛ばす
  reading: とばす
  level: N3
  partOfSpeech: 動詞・五段・他動詞
  collocations:
  - 行を飛ばす
  - 手順を飛ばす
  - 一段飛ばす
  exampleJa: 削除された行を飛ばし、残りは選んだ順に表示します。
  meaningZh: 沿顺序处理时跳过其中一项。
  noteZh: 原文遇到两次查询之间删除的行便跳过。
  exampleZh: 跳过已删除的行，其余按选出顺序显示。
  nuanceZh: 突出在处理序列里越过一个位置。「省略する」也用于简化说明或不写某段内容。
grammar: []
mustRememberWords:
- 届く
- 通る
- 飛ばす
mustRememberGrammar: []
grammarSelectionNote: 将五篇原文与全90期、117个已学语法身份对照。「とは限らない」「ずに済む」「にとどまる」等已收录。此次没有核实到具独立新用法和可靠参考等级的未收录候选，新学0项，正文复习另列。
technicalTerms:
- term: ECE
  japanese: 期待較正誤差
  meaningZh: 按置信度区间汇总预测概率与实测正确程度的差异。
  contextZh: 跨数据集使用同一温度可能令该指标上升。
- term: 変異体
  japanese: ミュータント
  meaningZh: 对原代码施加一个小变化得到的待测试版本。
  contextZh: 修改比较边界后重跑相关测试。
- term: RSC payload
  japanese: サーバーコンポーネントの出力
  meaningZh: 包含服务端组件输出与客户端组件引用的数据。
  contextZh: 点击前是否拿到它影响切换时的等待。
- term: Row
  japanese: クエリ結果の一行
  meaningZh: 只包含本次选出列值的结果行。
  contextZh: 先用轻量行判定，入选后才构造完整对象。
- term: B-rep
  japanese: 境界表現
  meaningZh: 用曲面、边等边界定义实体的方式。
  contextZh: 扩展字段让三角形可以关联原始圆柱面。
- term: 弦のたわみ
  japanese: 円弧と弦の離れ
  meaningZh: 用直线段近似圆弧时两者的最大间距。
  contextZh: 比较圆孔分段数变化后的几何误差。
---
