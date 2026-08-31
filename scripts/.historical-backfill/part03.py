          ja='低Riskで検証可能な処理は自動化し、Business Impactが大きい判断や外部へのSide Effectは受け入れ基準を明確にした上でHuman Reviewを残します。',
          cn='低风险、可验证步骤可以自动化，高影响判断和外部副作用应保留明确的人类 Review', projects='QA Automation / Review Agent / Workflow Automation / Education Tech', kw=['受け入れ基準','人間の確認','自動検証'])
    return dict(cat='🤖 AI / Agent', q='この技術を本番へ導入する場合、どの点を重視しますか。',
      ja='PoCの成功だけで判断せず、品質、Cost、Security、Observability、Failure時のRecoveryを含めて実運用で評価します。',
      cn='生产化不能只看 PoC，需要同时验证质量、成本、安全、可观测性与失败恢复', projects='AI Application / Agent Platform / Internal Tool', kw=['品質評価','運用設計','障害対応'])

def parse_old(date):
    path=DAILY/f'{date}.md'; text=path.read_text(encoding='utf-8')
    parts=text.split('---',2); fm=yaml.safe_load(parts[1]); body=parts[2]
    # A summaries
    pre=body.split('### 面接で使えるポイント')[0] if '### 面接で使えるポイント' in body else body
    a_items=re.findall(r'^\d+\. \*\*(.+?)\*\*[：:]\s*(.+)$', pre, re.M)
    if len(a_items)<5:
        # 8/26 section style
        a_items=[]
        for i in range(1,6):
            m=re.search(rf'### {i}\.\s*([^\n]+)\n(.+?)(?=\n### {i+1}\.|\n### 面接で使えるポイント)',body,re.S)
            if m:
                a_items.append((m.group(1).strip(), re.sub(r'\n+',' ',m.group(2).strip())))
    # B only before C
    btext=body.split('## B.',1)[1] if '## B.' in body else ''
    btext=btext.split('## C.',1)[0].split('# C.',1)[0]
    b=[]
    for s in re.split(r'\n###\s+',btext)[1:]:
        lines=s.splitlines(); h=lines[0].strip()
        m1=re.search(r'\*\*中文：\*\*\s*(.+)',s); m2=re.search(r'\*\*日本語：\*\*\s*(.+)',s)
        if m1 and len(b)<5: b.append((h,m1.group(1).strip(),m2.group(1).strip() if m2 else ''))
    # tech theme
    mt=re.search(r'### 今日の(?:技術|技术)(?:テーマ|主题)[：:]([^\n]+)\n\n(.+?)(?=\n### 面试复习卡|\n## B\.)',body,re.S)
    tech=(mt.group(1).strip(),mt.group(2).strip()) if mt else ('今日の中心テーマ','当日のTop 5に共通するEngineering Principleを、実装・運用・評価の観点から整理します。')
    # review cards
    cards=[]
    mc=re.search(r'### 面试复习卡\n\n(.+?)(?=\n## B\.)',body,re.S)
    if mc:
        for q,a in re.findall(r'- `([^`]+)`\s*→\s*([^\n]+)',mc.group(1)):
            cards.append((q.strip(),a.strip().strip('。')))
    while len(cards)<3:
        cards.append((f'{fm["topics"][min(len(cards),len(fm["topics"])-1)]}について何を確認しますか。','品質 / Security / Cost / 運用'))
    return fm, a_items[:5], b[:5], tech, cards[:3]

def render_c(date):
    t=(JP/f'{date}.md').read_text(encoding='utf-8'); d=yaml.safe_load(t.split('---',2)[1])
    out=[]
    out += ['# C. 日本語学习｜JLPT + IT日本語','', '> JLPT 等级均为学习参考。以下内容直接使用当天已保存的结构化学习数据回填；JMdict / EDICT 可用于读音、词性和基本词义校对，但不提供官方 JLPT 等级。','']
    out += ['## C-1. JLPT词汇','']
    for i,v in enumerate(d.get('vocabulary',[]),1):
        out += [f'### {i}. {v.get("term","")}（{v.get("reading","")}）',
                f'**词性：** {v.get("partOfSpeech","")}  ',f'**中文：** {v.get("meaningZh","")}  ',f'**参考：{v.get("level","")}**  ',
                f'**搭配：** ' + ' / '.join(f'`{x}`' for x in v.get('collocations',[])) + '  ',
                f'**技术语境：** {v.get("noteZh","")}  ',f'**例句：** `{v.get("exampleJa","")}`  ',f'**中文：** {v.get("exampleZh","")}  ',f'**细微区别：** {v.get("nuanceZh","")}','']
    out += ['## C-2. IT/AI专业词汇','']
    for i,v in enumerate(d.get('technicalTerms',[]),1):
        out += [f'### {i}. {v.get("term","")}',f'**日本語：** {v.get("japanese","")}  ',f'**中文：** {v.get("meaningZh","")}  ',f'**当天语境：** {v.get("contextZh","")}','']
    out += ['## C-3. JLPT语法','']
    for i,g in enumerate(d.get('grammar',[]),1):
        out += [f'### {i}. {g.get("pattern","")}',f'**参考：{g.get("level","")}**  ',f'**中文：** {g.get("meaningZh","")}  ',f'**接续：** `{g.get("structure","")}`  ',f'**使用场景：** {g.get("usageZh","")}  ',f'**例句：** `{g.get("exampleJa","")}`  ',f'**中文：** {g.get("exampleZh","")}  ',f'**注意：** {g.get("noteZh","")}','']
    out += ['## C-4. 今日必背','', '### 10 个重点词','']
    for x in d.get('mustRememberWords',[]): out.append(f'- `{x}`')
    out += ['','### 5 个重点语法','']
    for x in d.get('mustRememberGrammar',[]): out.append(f'- `{x}`')
    out.append('')
    return '\n'.join(out)

THEME_LAYERS={
'Context Engineering':['User Request','Retrieval / Search','Scoped Context','Agent / Tool','Evaluation'],
'Model Routing':['Request','Complexity / Policy','Router','Selected Model','Quality / Cost Evaluation'],
'Agent-friendly Software Architecture':['Requirement / Convention','Structured Context','Generate','Type / Test / Audit','Fix / Review'],
'Agent Harness':['Input / Goal','Harness / Session','Model + Tool','Sandbox / Permission','Trace / Evaluation'],
'Agent Context Scoping':['Repository Rule','Directory Scope','Task Context','Agent Execution','Review / Update'],
'Secure RAG / MCP':['Authenticated Identity','Policy / ACL','Tenant Filter','Retrieval / Tool','Audit / Evaluation'],
'AI Agent Resource Governance':['User / Team','Usage Policy','Model / Agent Session','Cost / Resource Metering','Budget / Outcome Review'],
'Runtime-enforced Agent Security':['Instruction','Permission Policy','Sandbox / Runtime Enforcement','Audit / Security Validation','Human Review'],
'LLMOps':['Request / User','Prompt / Model / Tool Trace','Metrics / Cost','Evaluation','Continuous Improvement'],
'Agent Coverage Engineering':['Repository / System Inventory','Context Coverage','Agent Execution','Validation Coverage','Gap Review'],
'Agent Extension Supply Chain Security':['Source / Marketplace','Allowlist / Signature','Install / Version','Runtime Permission','Audit / Rollback'],
'Deterministic Agent Orchestration':['Goal','State Machine','Agent / Tool Step','Acceptance Check','Next State / Stop'],
'Agent Capability Control':['Identity / Goal','Capability Policy','Tool / API Scope','Approval / Runtime','Audit / Revoke'],
'Long-running Agent Runtime':['Session Owner','Persistent State','Worker / Workspace','TTL / Budget / Permission','Monitoring / Recovery'],
'Progressive Tool Discovery':['Task Intent','Tool Catalog','Search / Namespace','Scoped Tool Set','Execution / Evaluation'],
}

def render(date):
    fm,a,b,tech,cards=parse_old(date)
    titles=TITLE_MAP[date]
    for i,x in enumerate(fm['top']):
