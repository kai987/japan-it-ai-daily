from pathlib import Path
import re, yaml, copy, json

ROOT=Path('src/content')
DAILY=ROOT/'daily'; JP=ROOT/'japanese'; OUT=DAILY

TITLE_MAP = {
'2026-08-12': [
'Claude Code hooksでAI Agentの実行プロセスを可観測化',
'BM25 を使用して Codex のトークン消費を約30%抑える',
'SageMaker AI：gpt-oss / GemmaなどのオープンモデルをFine-tuning',
'Next.js 16.3：Instant Navigationとパフォーマンス最適化',
'Meta Muse Glimmer：ローカルAI Agent向け30Bオープンモデル'],
'2026-08-13': [
'Claude Team / ChatGPT Business / Gemini Enterpriseを企業統制の観点で比較',
'NVIDIA NeMo Switchyard：Taskに応じてLLMを動的Routing',
'Claude Code Self-hosted Environment：EC2をAgent実行環境にする',
'Nemotron 3.5 Lightning：常駐Agent向けオープンモデル',
'Grok Bot：Agentが実際の業務アプリを操作'],
'2026-08-14': [
'Markdownログ検索Local MCP：個人KnowledgeをAgent Context Layerへ',
'Guren：AI Agent時代のFull-stack TypeScript Framework',
'AWS IAM Role Manager：自動設定は最小権限を意味しない',
'Google Classroom × Gemini：Rubric自動生成でもHuman Reviewを残す',
'LayerX：開発初期からIn-process QAを組み込む'],
'2026-08-15': [
'DeepSeek Harness 0.1：「Everything is a Plugin」',
'Prompt Injection：AgentがWebを読むこと自体がAttack Surfaceになる',
'Claude Code 2.1.232：Sub-agent ForkとSessionをまたぐ協調',
'Gemini 3.7 Flash：Coding / Web / Agent Workflowを強化',
'Amazon Bedrock AgentCore：HarnessとRuntimeを理解する'],
'2026-08-16': [
'Kiro IDE、サブディレクトリのAGENTS.mdをサポート',
'AI時代にGoが持つ価値：Machine-verifiableな開発',
'AWS DevOps Agent Guardrail、ReadOnlyAccessをサポート',
'Claude Code Remote ControlのServer mode',
'GLM-5.3：Post-trainingでLong-horizon Codingを強化'],
'2026-08-17': [
'Bedrock Managed Knowledge Base × MCP：Multi-tenant IsolationとAccess Control',
'Cloudflare Kitesurf：AI Agent向けに再設計されたHeadless Browser',
'Zed Delta：Prompt・議論・Code変更の理由を保存',
'GraphRAG：Local FactからGlobal Structureへ',
'Nemotron 3.5 Lightning：専用LLM Routing Judgeを学習'],
'2026-08-18': [
'Money Forward：ChatGPT / Claudeの利用量とコストを一元管理',
'VS Code 1.133：AI CodingのFeedback Loopを短縮',
'AWS Transform：Continuous ModernizationでLegacy改善を継続化',
'Codex Long Context：Context Windowが大きくても全部使うべきとは限らない',
'AI Security：Human-in-the-Loopは「すべての操作を承認」ではない'],
'2026-08-19': [
'AWS Continuum：脆弱性検出をClaude Code / Codex / Kiroへ組み込む',
'Zed Agent Panel：OS SandboxでAgentを強制的に制限',
'MCPは本当に常にDirect APIより優れているのか？',
'Wantedly：ObservabilityをInfraからLLMへ拡張',
'Google HEIR：AIが暗号化状態のデータを直接処理する'],
'2026-08-20': [
'LayerX：Langfuse × ClickHouseでLLMOps基盤を構築',
'Snowflake Cortex AI Gateway：Dynamic Model Routing',
'Claude Code effort：1 Requestあたりの推論量を制御',
'Kiro Agent Focus：Local / Cloud Sessionを一元管理',
'AI Agent Identity：Agentを普通のBotとして扱えない理由'],
'2026-08-21': [
'AIが自信満々に間違える理由：Data ModelにBusiness Semanticsが足りない',
'Legacy Modernization：AIが「読んでいないもの」が最も危険',
'CyberAgent：chezmoiでClaude Code / Codex設定を管理',
'日本企業のAI利用率は上昇、ただしCore System Integrationは依然不足',
'Cursor Continuity：大規模Git Hosting向け新Storage Architecture'],
'2026-08-22': [
'Next.js、重要なSecurity Patchを公開',
'Agent Plugins 1.0：Skill + MCP設定をClient間で再利用',
'MCP Tool Poisoningを実測',
'Amazon Bedrock AgentCore Web Search、東京Regionに対応',
'Codex resume --ephemeral：Exit Code 0でもDisk Writeがないとは限らない'],
'2026-08-23': [
'AI-DLC v2：Deterministic State MachineでAgent Workflowを管理',
'Claude Code v2.1.238～2.1.239：Reliability / Security / Hidden Billing',
'NeMo Switchyard Prefill Router',
'GPT-5.6 Sol API値下げとUsage Governance',
'Bedrock × VLM外観検査：Strong Model + Cheap Model + REVIEW'],
'2026-08-24': [
'Claude Code × Slack：allow / ask / denyによるPermission Design',
'Slack Code：Team DiscussionをCoding AgentのContextへ',
'Bun 1.4：Claude CodeがZig → Rust大規模Migrationに参加',
'Codex Usage過剰消費とMetering Reliability',
'日本企業のAI投資は拡大、全社的な継続成果はなお限定的'],
'2026-08-25': [
'GitHub Copilot Cloud Agent × Microsoft Teams',
'Liquid AI DSpark：Speculative Decoding',
'AWS DevOps Agent × GitHub MCP：障害調査後はIssue作成だけを許可',
'Claude Code Supervisor：SessionとCLI Processを分離',
'建設業界でAI活用が深化：ボトルネックは人材・Expert・ROIへ'],
'2026-08-26': [
'MCP最新Roadmap：Agent Identity、非同期Task、Progressive Tool Discovery',
'Next.js 16.3とCritical RCE Patch',
'Claude Code Runtime Governance',
'MCP Tool DefinitionのContext Cost',
'AI Vulnerability DiscoveryとTriage'],
}

URL_ADDITIONS = {
('2026-08-12',0): 'https://zenn.dev/alzcb4/articles/8a5ce86949b7ff',
('2026-08-13',0): 'https://dev.classmethod.jp/articles/summer-project-2026-ai-plans-admin-governance-comparison/',
('2026-08-13',1): 'https://dev.classmethod.jp/articles/nvidia-nemo-switchyard-v020-rust-first-touch/',
('2026-08-13',2): 'https://dev.classmethod.jp/articles/claude-code-self-hosted-runner/',
('2026-08-13',3): 'https://www.itmedia.co.jp/aiplus/article/2608/12/2000000503/',
('2026-08-13',4): 'https://www.itmedia.co.jp/aiplus/article/2608/12/2000000505/',
('2026-08-15',0): 'https://gihyo.jp/article/2026/08/deepseek-harness-developer-preview',
('2026-08-16',0): 'https://dev.classmethod.jp/articles/kiro-ide-subdirectry-agentsmd/',
('2026-08-16',2): 'https://dev.classmethod.jp/articles/devops-agent-readonlyaccess-permission-guardrail/',
('2026-08-16',3): 'https://zenn.dev/0msys/articles/486b44b3af083d',
('2026-08-16',4): 'https://gihyo.jp/article/2026/08/glm-5.3',
('2026-08-17',4): 'https://dev.classmethod.jp/articles/dgx-spark-nemotron-lightning-switchyard-classifier-finetune/',
('2026-08-18',2): 'https://dev.classmethod.jp/articles/aws-transform-continuous-modernization-hands-on/',
('2026-08-18',3): 'https://dev.classmethod.jp/articles/codex-context-window-1m-chatgpt-plan/',
('2026-08-18',0): 'https://www.itmedia.co.jp/aiplus/article/2608/18/2000000571/',
('2026-08-18',4): 'https://atmarkit.itmedia.co.jp/ait/articles/2608/18/news011.html',
('2026-08-20',1): 'https://dev.classmethod.jp/articles/modern-data-stack-info-summary-20260819/',
('2026-08-20',2): 'https://dev.classmethod.jp/articles/claude-code-effort-202608/',
('2026-08-20',4): 'https://atmarkit.itmedia.co.jp/ait/articles/2608/20/news017.html',
