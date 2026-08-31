('2026-08-21',1): 'https://dev.classmethod.jp/articles/legacy-modernization-ai-spec-gap/',
('2026-08-21',2): 'https://developers.cyberagent.co.jp/blog/archives/65099/',
('2026-08-23',1): 'https://dev.classmethod.jp/articles/20260822-cc-updates-v2-1-239/',
('2026-08-23',2): 'https://dev.classmethod.jp/articles/dgx-spark-switchyard-prefill-router-vs-judge/',
('2026-08-23',3): 'https://www.itmedia.co.jp/aiplus/article/2608/23/2000000700/',
('2026-08-23',4): 'https://dev.classmethod.jp/articles/bedrock-vlm-visual-inspection-generated-prompt/',
('2026-08-25',3): 'https://zenn.dev/uehaj/articles/claude-code-supervisor-agent-view',
}

CATEGORY_ORDER=['🤖 AI / Agent','💻 Frontend / Web','☁️ Cloud / Backend','🏢 日本企业 Tech Blog']

def guide(topic,title,source=''):
    s=(topic+' '+title+' '+source).lower()
    if any(k in s for k in ['security','iam','guardrail','prompt injection','vulnerability','权限','access control','tool poisoning']):
        return dict(cat='☁️ Cloud / Backend', q='この仕組みを本番環境で安全に利用する場合、どのようなSecurity Controlが必要ですか。',
          ja='ModelへのInstructionだけに依存せず、最小権限、Runtimeでの強制、監査ログ、必要に応じたHuman Approvalを組み合わせてDefense in Depthを設計します。',
          cn='安全性不能只交给 Prompt，应叠加最小权限、Runtime 强制、审计日志和必要的人类批准', projects='Coding Agent / MCP / Enterprise Security / Cloud Platform', kw=['最小権限','実行境界','監査ログ'])
    if any(k in s for k in ['mcp','rag','context','retrieval','bm25','graphrag','knowledge']):
        return dict(cat='🤖 AI / Agent', q='このContext / Retrieval設計を本番で使う場合、何を評価しますか。',
          ja='必要な情報だけを渡すScope設計とAccess Controlを分けて考え、検索漏れ、Context Cost、回答品質を実Workloadで評価します。',
          cn='Context 设计需要同时管理相关性、访问范围、Token 成本与检索遗漏，并用真实任务做评价', projects='RAG / MCP / Coding Agent / Knowledge Platform', kw=['コンテキスト管理','検索精度','権限制御'])
    if any(k in s for k in ['routing','router','model','llm inference','speculative','gemini','nemotron','glm','fine-tun','open model','local llm','muse']):
        return dict(cat='🤖 AI / Agent', q='複数Modelや推論方式を使い分ける場合、どのように判断しますか。',
          ja='Benchmarkだけで決めず、Task Quality、Latency、Cost、Failure Rateを同じ評価セットで比較し、必要なら弱いModelから強いModelへ段階的に切り替えます。',
          cn='模型选择不能只看 Benchmark，应共同衡量任务成功率、延迟、成本与失败率', projects='Model Routing / LLM Platform / AI Inference / Evaluation', kw=['モデル選択','レイテンシ','コスト最適化'])
    if any(k in s for k in ['fhe','homomorphic','heir','privacy','暗号','encrypted']):
        return dict(cat='🤖 AI / Agent', q='Privacy-preserving AIを本番で利用する場合、どの点を評価しますか。',
          ja='暗号化によるData Protectionだけでなく、計算Cost、Latency、対応Operation、Key Managementを確認し、機密性と実用性能の両方を実Workloadで評価します。',
          cn='隐私保护型 AI 不仅要确认数据是否保持加密，还要评估计算成本、延迟、支持的运算范围与密钥管理', projects='Privacy-preserving AI / Secure Analytics / Financial・Healthcare AI', kw=['データ保護','暗号化処理','性能評価'])
    if any(k in s for k in ['next.js','typescript','frontend','vs code','bun','framework','git hosting','zed']) or re.search(r'(^|[^a-z])go([^a-z]|$)', s):
        return dict(cat='💻 Frontend / Web', q='AI CodingをSoftware Engineeringに組み込むとき、何を重視しますか。',
          ja='生成速度よりも、Type Check、Static Analysis、Automated Test、CIなどの決定的なFeedbackで変更を検証し、Regressionを防ぐことを重視します。',
          cn='AI Coding 的可靠性来自类型、静态分析、自动测试与 CI 的确定性反馈，而不是一次生成结果', projects='React / Next.js / TypeScript / Developer Tooling', kw=['型安全','自動テスト','回帰検証'])
    if any(k in s for k in ['observability','llmops','langfuse','usage','metering','cost','roi']):
        return dict(cat='🏢 日本企业 Tech Blog' if any(k in source.lower() for k in ['layerx','wantedly','money','cyberagent']) else '🤖 AI / Agent', q='AI Systemの運用状況をどのように観測し、改善につなげますか。',
          ja='Request、Model、Token、Latency、Tool Call、User OutcomeをTraceできるようにし、Costと品質を同じDashboardで確認して継続改善につなげます。',
          cn='LLM 运维需要把请求、模型、Token、延迟、Tool Call 与业务结果放在同一可观测链路中', projects='LLMOps / SRE / AI Platform / FinOps', kw=['可観測性','トレーシング','継続改善'])
    if any(k in s for k in ['runtime','agentcore','harness','session','remote control','supervisor','self-hosted','computer-using','grok bot']):
        return dict(cat='☁️ Cloud / Backend', q='Agent Runtimeを本番運用するとき、どのような要件を管理しますか。',
          ja='Modelとは別に、Session、Tool、Credential、Network、Workspace、TTL、Cost、RecoveryをRuntimeの責務として管理し、実行範囲を明確にします。',
          cn='Agent Runtime 要独立管理 Session、Tool、Credential、Network、Workspace、TTL、成本与恢复', projects='Agent Runtime / Cloud Sandbox / Coding Agent / AIOps', kw=['実行基盤','セッション管理','サンドボックス'])
    if any(k in s for k in ['governance','enterprise','team','企業','人材','adoption','copilot','slack']):
        return dict(cat='🏢 日本企业 Tech Blog', q='AIを組織全体へ導入するとき、個人利用と何が違いますか。',
          ja='個人の便利さだけでなく、共通Policy、Permission、Audit、Education、Usage Measurementを整え、最終的には業務KPIで効果を確認する必要があります。',
          cn='组织级 AI 导入必须把 Policy、权限、审计、教育和业务 KPI 一起设计', projects='Enterprise AI / Internal Tool / Developer Platform / Governance', kw=['ガバナンス','利用状況','業務成果'])
    if any(k in s for k in ['qa','human-in-the-loop','rubric','review']):
        return dict(cat='🏢 日本企业 Tech Blog', q='AIの自動化とHuman Reviewをどのように使い分けますか。',
