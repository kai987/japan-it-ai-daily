from pathlib import Path
import json, re, yaml

ROOT = Path('src/content/daily')
ORD = '①②③④⑤'
PATCHES = [
    dict(date='2026-08-12', index=2, title='Amazon SageMaker AI、オープンソースモデルのServerless Full Fine-tuningに対応', source='AWS What’s New', url='https://aws.amazon.com/about-aws/whats-new/2026/08/amazon-sagemaker-fft/'),
    dict(date='2026-08-12', index=3, title='Next.js 16.3：Instant Navigationsとパフォーマンス最適化', source='Next.js / Vercel', url='https://nextjs.org/blog/next-16-3'),
    dict(date='2026-08-14', index=4, title='QAをやめて、QAをはじめる──欠陥検出0件が続いた組織で、品質保証の重心を3回動かした話', source='LayerX Engineering Blog', url='https://tech.layerx.co.jp/entry/quit-qa-start-qa'),
    dict(date='2026-08-15', index=4, title='Amazon Bedrock AgentCore 入門 - AI エージェントを自作しながら「ハーネス」の仕組みを学んでみた', source='DevelopersIO', url='https://dev.classmethod.jp/articles/agentcore-hands-on-study-agent-harness/'),
    dict(date='2026-08-16', index=1, title='AI時代は「Go言語」が理想の言語に？ Googleが解説する「Goの価値」', source='＠IT', url='https://atmarkit.itmedia.co.jp/ait/articles/2608/15/news013.html'),
    dict(date='2026-08-17', index=0, title='Amazon Bedrock AgentCoreでマルチテナントエージェントを構築する', source='AWS Japan', url='https://aws.amazon.com/jp/blogs/news/building-multi-tenant-agents-with-amazon-bedrock-agentcore/'),
    dict(date='2026-08-17', index=1, title='タブもテーマも拡張機能もないAI専用の超軽量ヘッドレスブラウザ「Kitesurf」、Cloudflareが発表', source='Publickey', url='https://www.publickey1.jp/blog/26/aikitesurfcloudflare.html'),
    dict(date='2026-08-17', index=2, title='Zed開発チームが「Delta」発表。人間とAIの全対話とコード変更履歴をコンテキストとして保存共有するコラボレーションツール', source='Publickey', url='https://www.publickey1.jp/blog/26/zeddeltaai.html'),
    dict(date='2026-08-18', index=1, title='Visual Studio Code 1.133正式リリース。プロンプトを見失わない固定スクロール、ローカルHTMLファイルの自動リロード、ClaudeとCopilotの混在可能など新機能', source='Publickey', url='https://publickey1.jp/blog/26/visual_studio_code_1133htmlclaudecopilot.html'),
    dict(date='2026-08-19', index=0, title='AWS、Anthropic・OpenAIと連携し「AWS Continuum」をClaude Code / Codex / Kiroへ統合', source='AWS Security Blog', url='https://aws.amazon.com/blogs/security/aws-partners-with-anthropic-and-openai-to-bring-aws-continuum-into-developer-workflows/'),
    dict(date='2026-08-19', index=1, title='Zed Agent Panel：OS SandboxでAgentを強制的に制限', source='Zed', url='https://zed.dev/blog/sandboxing'),
    dict(date='2026-08-20', index=0, title='Langfuse トレース取り込み処理の改善による ClickHouse の負荷低減', source='LayerX Engineering Blog', url='https://tech.layerx.co.jp/entry/langfuse-clickhouse-read-skip'),
    dict(date='2026-08-20', index=3, title='Kiro IDEのAgent Focusモードでセッションのピン留めとCloud Sessionsが使えるようになったので確認してみた', source='DevelopersIO', url='https://dev.classmethod.jp/articles/kiro-agentfocus-pinning-cloudsession/'),
    dict(date='2026-08-21', index=0, title='SnowflakeにおけるAIエージェント向けの内部コンテキストレイヤーの構築', source='Snowflake', url='https://www.snowflake.com/ja/blog/snowflake-internal-context-layer-for-ai-agents/'),
    dict(date='2026-08-21', index=3, title='生成AI活用企業の67.1％が、いまだ「人が起動」──「Japan AI Operations Report 2026 Summer」を公開', source='Mer', url='https://www.merinc.co.jp/news/japan-ai-operations-report-2026-summer'),
    dict(date='2026-08-21', index=4, title='Cursor：大規模Gitホスティング向けStorage Architecture「Continuity」', source='Cursor', url='https://prod.cursor.com/blog/git-at-any-scale'),
    dict(date='2026-08-23', index=0, title='「AI-DLC の紹介」というタイトルでゆるWeb勉強会@札幌で登壇しました #ゆるWeb札幌', source='DevelopersIO', url='https://dev.classmethod.jp/articles/yuruweb-31-iwasa/'),
]

def dump_frontmatter(fm):
    out = ['---']
    for key in ['title', 'date', 'description', 'topics', 'sources', 'featured']:
        value = fm[key]
        if key == 'date':
            out.append(f'date: {value}')
        elif isinstance(value, bool):
            out.append(f'{key}: {str(value).lower()}')
        elif isinstance(value, list):
            out.append(f'{key}: ' + json.dumps(value, ensure_ascii=False))
        else:
            out.append(f'{key}: ' + json.dumps(str(value), ensure_ascii=False))
    out.append('top:')
    for item in fm['top']:
        for j, key in enumerate(['title', 'source', 'topic', 'why', 'url']):
            if key not in item or item[key] in (None, ''):
                continue
            prefix = '  - ' if j == 0 else '    '
            out.append(f'{prefix}{key}: ' + json.dumps(str(item[key]), ensure_ascii=False))
    out += ['---', '']
    return '\n'.join(out)

by_date = {}
for p in PATCHES:
    by_date.setdefault(p['date'], []).append(p)

for date, patches in by_date.items():
    path = ROOT / f'{date}.md'
    text = path.read_text(encoding='utf-8')
    pieces = text.split('---', 2)
    if len(pieces) != 3:
        raise RuntimeError(f'invalid frontmatter: {date}')
    fm = yaml.safe_load(pieces[1])
    body = pieces[2].lstrip('\n')

    for p in sorted(patches, key=lambda x: x['index']):
        item = fm['top'][p['index']]
        old_title = item['title']
        old_source = item.get('source', '')
        item['title'] = p['title']
        item['source'] = p['source']
        item['url'] = p['url']
        body = body.replace(old_title, p['title'])

        heading = f'### {ORD[p["index"]]} {p["title"]}'
        start = body.find(heading)
        if start < 0:
            raise RuntimeError(f'top section not found: {date} #{p["index"]+1}')
        end = body.find('\n---', start)
        if end < 0:
            raise RuntimeError(f'top section end not found: {date} #{p["index"]+1}')
        section = body[start:end]
        section, n1 = re.subn(r'(?m)^\*\*来源：.*?\*\*\s*$', f'**来源：{p["source"]}**  ', section, count=1)
        section, n2 = re.subn(r'(?m)^\*\*原文：\*\*.*$', f'**原文：** {p["url"]}', section, count=1)
        if n1 != 1 or n2 != 1:
            raise RuntimeError(f'body metadata patch failed: {date} #{p["index"]+1}: source={n1}, url={n2}')
        body = body[:start] + section + body[end:]

    # Recompute source list from the actual Top 5 metadata.
    sources = []
    for item in fm['top']:
        s = item.get('source')
        if s and s not in sources:
            sources.append(s)
    fm['sources'] = sources

    path.write_text(dump_frontmatter(fm) + body.rstrip() + '\n', encoding='utf-8')

# Validation: every verified mapping must exist in frontmatter and body, and its old
# unresolved marker must be gone from the corresponding Top 5 section.
for p in PATCHES:
    path = ROOT / f'{p["date"]}.md'
    text = path.read_text(encoding='utf-8')
    fm = yaml.safe_load(text.split('---', 2)[1])
    item = fm['top'][p['index']]
    assert item['title'] == p['title'], (p, item)
    assert item['source'] == p['source'], (p, item)
    assert item['url'] == p['url'], (p, item)
    heading = f'### {ORD[p["index"]]} {p["title"]}'
    start = text.index(heading)
    end = text.index('\n---', start)
    section = text[start:end]
    assert p['url'] in section
    assert '当时未保存原文链接' not in section

print(f'Patched and validated {len(PATCHES)} historical article URLs across {len(by_date)} daily reports.')
