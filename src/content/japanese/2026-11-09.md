---
title: 日语学习｜2026年11月9日
date: '2026-11-09'
description: 用开发环境和检索出处练习描述空闲与保留。
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
  meaningZh: 原来占用的空间或时间变得可以使用。
  noteZh: 并行开发原文用「空いているポート」表示未占用的端口。
  exampleZh: 等测试端口空出来再启动开发服务器。
  nuanceZh: 「ポートが空く」描述端口变为可用，「ポートを空ける」表示人为腾出端口。
- term: 残る
  reading: のこる
  level: N5/N4
  partOfSpeech: 動詞・五段・自動詞
  collocations:
  - ログに残る
  - 出典が残る
  - 記録が残る
  exampleJa: ツールの出力をまとめ直した後も、元の記事へのリンクが残るか確かめます。
  meaningZh: 处理或变化结束后仍然保留。
  noteZh: Web Answer 原文指出最终回答未必保留工具输出中的出处。
  exampleZh: 改写工具输出后，检查原文链接是否还在。
  nuanceZh: 这是描述保留状态的自动词。主动保留出处用「出典を残す」。参考等级为 N4，站内归入 N5/N4。
grammar: []
mustRememberWords:
- 空く
- 残る
mustRememberGrammar: []
grammarSelectionNote: 已将五篇原文与全部89期、117个既习语法身份对照。「をもとに」「とは限らない」等已收录。未核实具有独立用法与参考等级的未收录文型，本期新学为0项，复习另列。
technicalTerms:
- term: MCP
  japanese: モデルと外部ツールを接続するプロトコル
  meaningZh: 用于发现和调用外部工具的协议。
  contextZh: AgentCore Gateway 将 Web Answer 提供给外层调用者。
- term: PreToolUse
  japanese: ツール実行前のフック
  meaningZh: 工具执行前可检查请求的扩展点。
  contextZh: 在 shell 命令生效前检查会话的进程和端口。
- term: TLS SNI
  japanese: TLS接続時に示すサーバー名
  meaningZh: 客户端建立 TLS 连接时提供的服务器名称。
  contextZh: 实验用它判断 HTTPS 请求匹配哪个域名规则。
- term: OTLP
  japanese: OpenTelemetry Protocol
  meaningZh: 传输遥测数据的协议。
  contextZh: 示例中的应用计数器通过代理送到 CloudWatch。
- term: SigV4
  japanese: AWS署名バージョン4
  meaningZh: AWS API 请求的签名认证方式。
  contextZh: AMP 插件可用它向 CloudWatch 监控端点查询。
- term: Set
  japanese: 集合
  meaningZh: 用于记录不同值的集合结构。
  contextZh: kiln 用它检查当前层级的归一化文本是否出现过。
---
