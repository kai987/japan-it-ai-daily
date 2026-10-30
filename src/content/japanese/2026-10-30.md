---
date: '2026-10-30'
topics:
- LLM推論の状態とゼロ台からの起動
- GPU共有の性能と信頼の境界
- 仮想オフィスの音声購読権限
- Next.js基盤の複数リージョン運用
- WebAssemblyとLinuxの接点
title: 日语学习｜2026年10月30日（第80号）
description: 从推理、GPU共享、通话授权、多区域和WebAssembly学习。
levels:
- N1
- N2
- N3
vocabularyCount: 6
grammarCount: 0
grammarSelectionNote: 五篇原文与全历史115文型对照后，新语法为0项。たうえで、に応じて、わけではない、たびに、に合わせて、からこそ等已学，不把表记或活用差异当新增；当日本文可核对的既学语法另列复习。
vocabulary:
- term: 中継
  reading: ちゅうけい
  partOfSpeech: 名詞・する動詞
  level: N1
  collocations:
  - 音声を中継する
  - 中継サーバー
  exampleJa: 音声を中継するサーバーで、配送先を制限します。
  meaningZh: 中继；在发送方和接收方之间转送信息。
  noteZh: LiveKit原文指出SFU中继音声和视频，这不是端到端加密。
  exampleZh: 在中继音声的服务器上限制配送对象。
  nuanceZh: 中継强调中间节点转送；引き継ぐ是交接职责，継承是继承。
- term: 賄う
  reading: まかなう
  partOfSpeech: 五段動詞・他動詞
  level: N1
  collocations:
  - 費用を賄う
  - 一つの仕組みで賄う
  exampleJa: 起動待ちと混雑時の保留を、一つの待ち行列で賄います。
  meaningZh: 供应、承担；以现有资源或方法满足所需。
  noteZh: EKS原文用同一Flow Control机制承担饱和等待和零实例启动等待。
  exampleZh: 用同一个等待队列处理启动等待与拥塞时的保留。
  nuanceZh: 这里不是吃饭招待，而是满足两种处理需求。
- term: 推測
  reading: すいそく
  partOfSpeech: 名詞・する動詞
  level: N1
  collocations:
  - 原因を推測する
  - 観測から推測する
  exampleJa: 測定値の差の理由は、まだ推測にとどまります。
  meaningZh: 推测；根据有限线索推想尚未确认的事。
  noteZh: GPU原文对吞吐比例略高和资源争抢原因使用推测语气，并未宣称证实。
  exampleZh: 测量值有差异的原因目前仍只是推测。
  nuanceZh: 予測着眼将来，推測也可针对已经发生但原因不明的事情；不是计测本身。
- term: 裏返す
  reading: うらがえす
  partOfSpeech: 五段動詞・他動詞
  level: N2
  collocations:
  - 関係を裏返す
  - カードを裏返す
  exampleJa: 誰を聞けるかという関係を裏返し、話す側の許可を作ります。
  meaningZh: 翻面、反过来；此处指把关系的方向倒转。
  noteZh: Hotori把near集合反向变成每位发布者的allow集合。
  exampleZh: 把“能听见谁”的关系反向，生成说话方的许可。
  nuanceZh: 返す是归还或返回；裏返す在这里是关系转置，不是返回响应，也不意味着名单对称。
- term: 見慣れる
  reading: みなれる
  partOfSpeech: 一段動詞・自動詞
  level: N2
  collocations:
  - 見慣れた名前
  - 見慣れない用語
  exampleJa: 見慣れた名前でも、型の大きさは別に確かめます。
  meaningZh: 看惯、因经常看而熟悉。
  noteZh: WALI原文先解释Web开发者可能不熟悉的系统调用、ABI等术语。
  exampleZh: 即使名称熟悉，也要另行确认类型尺寸。
  nuanceZh: 慣らす是使人适应，手慣れる是操作熟练；見慣れる强调视觉和名称的熟悉，不等于理解契约。
- term: 行儀
  reading: ぎょうぎ
  partOfSpeech: 名詞
  level: N3
  collocations:
  - 行儀よく振る舞う
  - 行儀がよい
  exampleJa: クライアントの行儀のよさだけに、権限の判断を任せません。
  meaningZh: 举止、行为规矩；这里比喻客户端遵守约定。
  noteZh: Hotori指出接收方浏览器“行儀よく振る舞う”是旧方案的隐含前提。
  exampleZh: 不会只依靠客户端行为守规矩来决定权限。
  nuanceZh: 这是礼仪词的比喻，不是正式的安全机制名称，也不代表程序不可修改。
grammar: []
technicalTerms:
- term: KV cache
  japanese: KVキャッシュ
  meaningZh: 保存注意力计算中间结果、供后续生成复用的缓存。
  contextZh: 路由要同时考虑缓存位置与排队，历史推定不等于真实目录。
- term: Endpoint Picker
  japanese: EPP
  meaningZh: 根据推理实例内部状态选择请求接收Pod的组件。
  contextZh: 与负责实际转发的Envoy Proxy分工。
- term: NVIDIA Multi-Process Service
  japanese: NVIDIA MPS
  meaningZh: 让多个进程共享GPU执行资源的机制。
  contextZh: 文中ECS额度通过容器环境变量传入，不等于不可信租户隔离。
- term: Selective Forwarding Unit
  japanese: SFU
  meaningZh: 选择并转发媒体音轨的服务器。
  contextZh: LiveKit通过发布者许可拒绝向未授权接收者配送。
- term: MultiRegion endpoint
  japanese: マルチリージョンエンドポイント
  meaningZh: 把Web后端部署到多个区域的接入端点。
  contextZh: 文章中的区域变更需新建端点再切CloudFront源站。
- term: WebAssembly Linux Interface
  japanese: WALI
  meaningZh: 以Linux系统调用导入作为WebAssembly与宿主之间薄层的提案。
  contextZh: 需要对应Linux运行环境，不是浏览器直接获得Linux。
- term: Application Binary Interface
  japanese: ABI
  meaningZh: 类型大小、数据布局等二进制组件之间的约定。
  contextZh: WALI的32位指针和64位long与普通WASI构建物不兼容。
mustRememberWords:
- 中継
- 賄う
- 推測
- 裏返す
- 見慣れる
- 行儀
mustRememberGrammar: []
---
