        x['title']=titles[i]
        if not x.get('url') and (date,i) in URL_ADDITIONS: x['url']=URL_ADDITIONS[(date,i)]
    # keep short aliases from A/B aligned by order
    while len(a)<5: a.append((titles[len(a)], fm['top'][len(a)]['why']))
    while len(b)<5: b.append((titles[len(b)], fm['top'][len(b)]['why'], 'このテーマでは、品質・Cost・Security・運用を総合的に評価することが重要です。'))
    lines=[]
    # YAML frontmatter with readable dump
    lines.append('---')
    # custom emit to preserve style and avoid aliases
    for key in ['title','date','description','topics','sources','featured']:
        val=fm[key]
        if key=='date': lines.append(f'date: {val}')
        elif isinstance(val,bool): lines.append(f'{key}: {str(val).lower()}')
        elif isinstance(val,list): lines.append(f'{key}: ' + json.dumps(val, ensure_ascii=False))
        else: lines.append(f'{key}: ' + json.dumps(str(val), ensure_ascii=False))
    lines.append('top:')
    for x in fm['top']:
        lines.append('  - title: '+json.dumps(x['title'],ensure_ascii=False))
        lines.append('    source: '+json.dumps(x.get('source',''),ensure_ascii=False))
        lines.append('    topic: '+json.dumps(x.get('topic',''),ensure_ascii=False))
        lines.append('    why: '+json.dumps(x.get('why',''),ensure_ascii=False))
        if x.get('url'): lines.append('    url: '+json.dumps(x['url'],ensure_ascii=False))
    lines += ['---','', '# A. 详细文字版','', f'> 本期围绕 **{fm["description"]}** 展开。以下保留当天原有 Top 5 选题，并用统一的生产工程视角补充架构、风险、面试表达与落地判断。','',
              '> 共同主线是：**模型能力只是起点，真正决定 AI / Agent 能否进入生产环境的是 Context、Permission、Runtime、Evaluation、Observability 与组织 Governance 能否形成闭环。**','',
              '## 1. 今日最值得看的 5 篇','']
    for i,(top,aitem,bitem) in enumerate(zip(fm['top'],a,b),1):
        g=guide(top.get('topic',''),top['title'],top.get('source',''))
        lines += [f'### {"①②③④⑤"[i-1]} {top["title"]}','',f'**来源：{top.get("source","")}**  ']
        if top.get('url'): lines += [f'**原文：** {top["url"]}','']
        else: lines += ['**原文：** 当时未保存原文链接（为避免误链，不补写未经核验的 URL）。','']
        lines += [aitem[1],'',bitem[1],'',f'从工程落地看，{g["cn"]}。{top.get("why","")}','', '**为什么值得看：★★★★★**','',
                  f'{top.get("why","")} 这类问题很适合在日本 AI / Web 工程师面试中从“PoC → Production”的角度讨论，而不只停留在产品功能介绍。','', '---','']
    # categories
    groups={k:[] for k in CATEGORY_ORDER}
    for i,top in enumerate(fm['top']): groups[guide(top.get('topic',''),top['title'],top.get('source',''))['cat']].append((top,a[i][1]))
    lines += ['## 2. 分类速览','']
    for cat in CATEGORY_ORDER:
        lines += [f'### {cat}','']
        if groups[cat]:
            for top,summ in groups[cat]: lines.append(f'- **{top["title"]}**：{summ}')
            lines += ['', '这一类内容的共同重点是：不要把 AI Feature 当成孤立功能，而要把它放回现有 Software Engineering、Security、SRE 或组织流程中评价。','']
        else:
            lines += ['严格按当天 Top 5 来看，没有比其他分类更值得单独展开的新文章，因此不使用旧新闻补位。','']
    # interviews
    lines += ['## 3. 面接で使えるポイント','']
    for i,(top,bitem) in enumerate(zip(fm['top'],b),1):
        g=guide(top.get('topic',''),top['title'],top.get('source',''))
        baseja=bitem[2] or 'このテーマでは、品質・Cost・Security・運用を総合的に評価することが重要です。'
        lines += [f'### 话题 {i}：{top["title"]}','', '**面试问题：**','',f'> {g["q"]}','', '**约 30 秒自然日语回答：**','',
                  f'> {baseja} {g["ja"]} そのため、PoCだけで判断せず、実際のWorkloadで段階的に検証しながら導入することが重要だと考えています。','',
                  f'**可关联项目类型：** {g["projects"]}  ',f'**3 个关键词：** ' + ' / '.join(f'`{x}`' for x in g['kw']),'']
    # tech theme
    theme,oldtech=tech
    layers=THEME_LAYERS.get(theme,['Requirement / Identity','Context / Policy','Model / Agent','Tool / Runtime','Evaluation / Observability'])
    tg=guide(theme,theme,'')
    lines += ['## 4. 今日の技術テーマ','',f'# {theme}','',oldtech,'', '```text'] + [layers[0]]
    for x in layers[1:]: lines += ['  ↓',x]
    lines += ['```','', '### 优点','',
              f'**第一，减少无关复杂度。** 通过把职责拆成 `{layers[0]}` 到 `{layers[-1]}` 的明确层次，可以让模型只处理概率性判断，而把权限、验证和停止条件交给确定性系统。','',
              f'**第二，更容易测量与回滚。** 每一层都能单独记录 Input / Output / Cost / Failure，出现异常时可以定位问题，而不是把所有错误都归因于“模型不够好”。','',
              f'**第三，更适合团队规模化。** {tg["cn"]}，因此可以把个人技巧转成可复用的 Platform Rule、CI Check 或 Governance Policy。','',
              '### 局限','',
              '**系统复杂度会上升。** 多一层 Router、Policy、Sandbox、Trace 或 Evaluation 都会带来开发和维护成本，需要确认它解决的是实际风险，而不是为了“架构完整”而堆层。','',
              '**确定性 Guardrail 也可能配置错误。** Policy、Test、Metric 与 Retrieval Rule 都需要版本管理和持续校准，不能因为“不是 LLM”就默认它绝对正确。','',
              '### 日本企业落地时的注意点','',
              '1. 先明确 **Owner、Data Boundary、Permission、Approval、Audit、Rollback**，再扩大 Agent 自治范围。  ',
              '2. 把现有的 **CI/CD、SRE、Security Review、Change Management** 继续保留，不因为接入 AI 就另建一套不可追踪的旁路。  ',
              '3. 用日本企业实际关心的 **品質、工数、Cost、Security Incident、Business Outcome** 评价，而不是只统计 AI 使用次数。','',
              '面试里可以这样总结：','',f'> {tg["ja"]}','',
              '## 5. 面试复习卡','']
    for i,(q,ans) in enumerate(cards,1): lines += [f'### Q{i}',f'> {q}','',f'回答要点：**{ans}**','']
    # B
    lines += ['# B. 重点总结和面试可用的知识点｜重要ポイントと面接で使える知識','']
    for i,(top,bitem) in enumerate(zip(fm['top'],b),1):
        g=guide(top.get('topic',''),top['title'],top.get('source',''))
        lines += [f'## {i}. {top["title"]}','', '### 中文知识点总结','',
                  f'1. **核心结论：** {bitem[1]}',
