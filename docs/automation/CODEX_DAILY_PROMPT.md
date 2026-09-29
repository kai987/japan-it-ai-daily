# Codex local daily task prompt

Status: local Codex heartbeat enabled by explicit user request on 2026-09-29. First scheduled production date: 2026-09-30, daily 10:00 Asia/Tokyo in the existing repository chat. The former ChatGPT daily task is paused. See CODEX_LOCAL.md for the cutover record.

Use this prompt in the repository's Codex chat:

> 执行本仓库的日本 IT/AI 日报本地任务。先读取 AGENTS.md、docs/automation/CODEX_LOCAL.md 及其列出的最新完整合同，使用当前源代码和真实观察执行，不依赖旧聊天摘要。
>
> 先确认真实 JST 时间，fetch 最新 main，检查完整文件清单、全部已登记日期、进度分支、当前租约、发布请求和 publisher/Pages 状态。用真实 observation 调用 scripts/daily-publication.mjs 的 mode=daily planner，最早到期且未完成日期优先；文字已验证且无变化则跳过文字生成，并按 CODEX_AUDIO.md 检查未完成音频；文字和音频均验证完成且无变化才结束，不制造空提交，不重写已发布日报，不提前生成明天。部分读取或访问失败不代表不存在。
>
> 有待生成日期时，先确认本次模式和远程发布授权，再遵守当前 schemaVersion 2 leaseId 租约合同，冻结日期/来源窗口并逐步保存可恢复进度。核实原文，保留背景、机制、实验条件、结果、限制；中日正文分别从原文生成。完成该日四正文、evidence 和 canonical interviews，全历史检查新学与复习身份，不凑数，不削弱验收。
>
> 运行本地完整门禁；正式发布模式下，使用完整 main 树建立日期草稿分支，精确 draft commit 预检通过后只提交 source-bound 发布请求，由唯一 publisher 写 main。核实最终同一提交的 Pages、页面字节和完整学习快照后才报告发布。只有本次新完成的日报才按既有合同尝试一次 N1 交接，并单独报告其真实结果。
>
> 从 2026-09-30 起，本每日调度按 publish 模式实际生成并发布到期日报，沿用唯一 publisher 和完整验收；用户已授权由 Codex 接替原 ChatGPT 日报作者。运行时先确认真实 JST 时间，早于首次日期不生成。不改变其他定时任务，不恢复旧作者。保留本地迁移规则和用户改动；日期草稿来自完整最新 main，迁移文档不混入该日六路径发布提交。
>
> 遇到失败读取准确日志并保存实际结果；不得绕过权限、不强推、不隐瞒不足。从 2026-09-30 起，文字发布验证后必须按 docs/automation/CODEX_AUDIO.md 执行：启动 AivisSpeech → 按冻结 targetDate 生成录音 → 校验 → 音频独立提交并触发现有 R2 上传 → 核验同一提交的 Pages、R2 字节及线上真实播放。固定 morioki / ノーマル（497929760），使用显式 --date；新日期默认 1.00 语速，恢复已有日期保留已验证 manifest 的参数并冻结到进度记录；禁止 --all/--force、修改正文或改用付费 API。音频进度单独持久化，文字 idle 也要恢复未完成音频；失败保留文字上线结果并准确报告，不跳过 N1、不重复生成已验证录音。输出简短的日期、执行分支、检查结果、修改文件和剩余限制。

For an explicitly requested validation-only rehearsal, use trial mode instead: read remote state and validate locally without remote writes, pushes, deployment or schedule changes. The 2026-09-29 trial remains a historical validation-only record, not proof of a fresh Codex-authored release.
