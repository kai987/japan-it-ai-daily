                  f'2. **工程判断：** {top.get("why","")}',
                  f'3. **生产化要点：** {g["cn"]}。',
                  '4. **面试表达：** 说明技术价值时，同时给出适用条件、Trade-off 与验证方法，比只介绍“能做什么”更完整。','',
                  '### 日本語の知識ポイント','',
                  f'1. **{bitem[2] or "このテーマでは、品質・Cost・Security・運用を総合的に評価することが重要です。"}**',
                  f'2. **{g["ja"]}**',
                  '3. **導入判断では、適用条件とTrade-offを明確にし、実際のWorkloadで評価することが重要です。**',
                  '4. **本番運用では、変更履歴、監査性、Rollback手段まで含めて設計する必要があります。**','', '---','']
    lines.append(render_c(date))
    content='\n'.join(lines).rstrip()+'\n'
    (OUT/f'{date}.md').write_text(content,encoding='utf-8')
    return content

for d in sorted(TITLE_MAP):
    render(d)

# 8/27 was a transition day: A/B were already long-form, but titles and C cards
# still used the older mixed/compact format. 8/28 and 8/30 also kept compact C data.
TITLE_REPLACEMENTS_27 = [
    ('LINEヤフー Agent i：Agent Builder 与 Agent Runtime 如何兼顾易用性与生产安全', 'LINEヤフー Agent i：Agent BuilderとAgent Runtimeで「作りやすさ」と本番安全性を両立'),
    ('AI活用率100％のQA組織をつくるまで', 'LINEヤフー：AI活用率100％のQA組織をつくるまで'),
    ('GitHub EnterpriseにおけるCopilotの統制：AI ControlsとManaged Settings', 'GitHub EnterpriseにおけるCopilot統制：AI ControlsとManaged Settings'),
    ('REST APIにTypeSpecを導入してスキーマ駆動開発', 'LayerX：TypeSpec × Schema-driven Development × Coding Agent'),
    ('JetBrains、ローカル環境向けのAIコーディングエージェント『Junie Local』を公開', 'JetBrains Junie Local：Local Coding Agentをより簡単に導入'),
    ('LINEヤフー Agent i：Agent Builder 与 Agent Runtime 如何兼顾“谁都能做”和“安全上线”', 'LINEヤフー Agent i：Agent BuilderとAgent Runtimeで「作りやすさ」と本番安全性を両立'),
    ('LINEヤフー：AI活用率100％のQA組織をつくるまで', 'LINEヤフー：AI活用率100％のQA組織をつくるまで'),
    ('GitHub Enterprise：AI Controls 与 Enterprise Managed Settings', 'GitHub EnterpriseにおけるCopilot統制：AI ControlsとManaged Settings'),
    ('LayerX：TypeSpec × Schema-driven Development × Coding Agent', 'LayerX：TypeSpec × Schema-driven Development × Coding Agent'),
    ('JetBrains Junie Local：Local Coding Agent 变得更容易安装', 'JetBrains Junie Local：Local Coding Agentをより簡単に導入'),
]

def replace_c(date):
    path=DAILY/f'{date}.md'
    text=path.read_text(encoding='utf-8')
    m=re.search(r'(?m)^# C\. 日本語学习[^\n]*\n|^## C\. 日本語学习[^\n]*\n', text)
    if not m:
        raise RuntimeError(f'C section not found: {date}')
    path.write_text(text[:m.start()] + render_c(date).rstrip() + '\n', encoding='utf-8')

p27=DAILY/'2026-08-27.md'
t27=p27.read_text(encoding='utf-8')
for old,new in TITLE_REPLACEMENTS_27:
    t27=t27.replace(old,new)
p27.write_text(t27,encoding='utf-8')

for d in ['2026-08-27','2026-08-28','2026-08-30']:
    replace_c(d)

# Fail fast if any historical page still lacks the final-card structure.
TARGET=[f'2026-08-{d:02d}' for d in range(12,29)] + ['2026-08-30']
for d in TARGET:
    t=(DAILY/f'{d}.md').read_text(encoding='utf-8')
    required=['## 1. 今日最值得看的 5 篇','## 2. 分类速览','## 3. 面接で使えるポイント','## 4. 今日の技術テーマ','## 5. 面试复习卡','# B. 重点总结和面试可用的知识点','# C. 日本語学习｜JLPT + IT日本語','## C-1. JLPT词汇','## C-2. IT/AI专业词汇','## C-3. JLPT语法','## C-4. 今日必背']
    missing=[x for x in required if x not in t]
    if missing:
        raise RuntimeError(f'{d}: missing sections {missing}')
    c1=t.split('## C-1.',1)[1].split('## C-2.',1)[0]
    c2=t.split('## C-2.',1)[1].split('## C-3.',1)[0]
    c3=t.split('## C-3.',1)[1].split('## C-4.',1)[0]
    if len(re.findall(r'^### \d+\.',c1,re.M)) != 20:
        raise RuntimeError(f'{d}: vocabulary card count mismatch')
    if len(re.findall(r'^### \d+\.',c2,re.M)) != 8:
        raise RuntimeError(f'{d}: technical term card count mismatch')
    if len(re.findall(r'^### \d+\.',c3,re.M)) != 7:
        raise RuntimeError(f'{d}: grammar card count mismatch')
    if c1.count('**细微区别：**') != 20:
        raise RuntimeError(f'{d}: nuance card count mismatch')

print('Historical daily backfill complete:', ', '.join(TARGET))
