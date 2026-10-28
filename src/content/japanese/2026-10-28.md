---
date: '2026-10-28'
topics:
- 分類の確信度と評価の境界
- ブラウザ内動画の生成と共有
- RDSのCPU使用率と待機負荷
- 依存関係の再現性と更新審査
- クローラーの名乗りと行動分析
title: 日语学习｜2026年10月28日（第78号）
description: 从置信度、canvas视频、RDS监控、依赖更新与访问分析学习。
levels:
- N1
vocabularyCount: 1
grammarCount: 0
grammarSelectionNote: 五篇原文的文型与全历史115项对照后，新语法为0个。とは限らない、だけで、ために、たうえで、にもかかわらず、に応じて等已学，不把表记或活用差异当作新增；当日本文可核对的既学用例另列复习。
vocabulary:
- term: 放り込む
  reading: ほうりこむ
  partOfSpeech: 動詞・五段（他動詞）
  level: N1
  collocations:
  - フォルダに放り込む
  - 受け皿へ放り込む
  exampleJa: 受け皿のフォルダへ放り込んだ書類は、提案を確認してから移動します。
  meaningZh: 随手扔进、放进某处。
  noteZh: 原文形容员工把待分类文档放进收件目录，而不是已经完成正式归档。
  exampleZh: 随手放进收件文件夹的文档，确认建议后再移动。
  nuanceZh: 比普通的入れる更强调随手投入；不表示目的目录已经核对正确。
grammar: []
technicalTerms:
- term: margin
  japanese: 一位と二位の得票差
  meaningZh: 本文中是第一、二名得票差相对于第一名的比例。
  contextZh: 单候选时即使证据弱也能为1，不等于正确率。
- term: weighted vote share
  japanese: 重み付き得票の占有率
  meaningZh: 首位目录得票权重占全部投票权重的比例。
  contextZh: 若仅一处获得非零票，修正式仍是1。
- term: IDF
  japanese: 語の珍しさの重み
  meaningZh: 按照文档频率调整词项权重的统计。
  contextZh: 原文用测量期之前的文档计算，避免未来信息。
- term: captureStream
  japanese: canvasの映像取り出し
  meaningZh: 把画布产生的画面交给媒体流的浏览器接口。
  contextZh: 先绘制首帧，再开始捕获，避免黑色开头。
- term: MediaRecorder
  japanese: メディアストリームの録画
  meaningZh: 按实际经过时间把媒体流记录成数据块。
  contextZh: 停止后等待onstop，最后的数据块就绪后再拼接文件。
- term: AAS
  japanese: 平均アクティブセッション数
  meaningZh: 平均正在执行或等待的数据库会话数。
  contextZh: 是DBLoad的单位，不是CPU百分比。
- term: DBLoadCPU
  japanese: CPU処理またはCPU待ちの負荷
  meaningZh: DBLoad中使用CPU或等待CPU的部分。
  contextZh: 与DBLoad的差帮助定位非CPU等待，具体原因需看事件。
- term: lockfile
  japanese: 具体的な依存グラフの記録
  meaningZh: 记录具体解析版本与依赖关系的文件。
  contextZh: 与npm ci配合使日常运行再现；升级应审查该图的变化。
- term: User-Agent
  japanese: 送信側が書く名乗り
  meaningZh: 请求方自报客户端身份的字符串。
  contextZh: 写着AI企业名并不证明真实归属。
- term: honeypot
  japanese: 攻撃の探索を記録する観測環境
  meaningZh: 用来记录探测与攻击行为的诱捕环境。
  contextZh: 原文环境没有真实秘密，因此不能据日志称窃密成功。
mustRememberWords:
- 放り込む
mustRememberGrammar: []
---
