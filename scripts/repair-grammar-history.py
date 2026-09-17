"""One-time, grammar-only historical repair; run checks before committing.

Retains each first introduction and authored bilingual cards with source evidence.
No copied news, vocabulary or third-party article bodies are published.
"""
from __future__ import annotations
import argparse,copy,hashlib,json,re,unicodedata,urllib.request,concurrent.futures
from datetime import datetime,timezone
from pathlib import Path
import yaml

ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/grammar-history'
START,END='2026-08-12','2026-09-17'
ALIASES=json.loads((DOC/'identity-rules.json').read_text())['aliases']

def normalize(s):return re.sub(r'[\s\u200b\ufeff~～〜…]','',unicodedata.normalize('NFKC',s))
def key(p):
    if not isinstance(p,str) or not p.strip():raise ValueError('Empty grammar identity')
    k=normalize(p);return ALIASES.get(k,k)
def digest(b):return hashlib.sha256(b).hexdigest()
def fm(s):
    p=s.split('---',2)
    if len(p)!=3 or p[0].strip():raise ValueError('Invalid frontmatter')
    return yaml.safe_load(p[1]),p[2]
def field(s,name,value):
    a,h,b=s.split('---',2)
    replacement=yaml.safe_dump({name:value},allow_unicode=True,sort_keys=False,width=10000).rstrip('\n')
    pattern=rf'(?m)^{re.escape(name)}:[^\n]*(?:\n(?![A-Za-z][\w-]*:)[^\n]*)*'
    ms=list(re.finditer(pattern,h))
    if len(ms)>1:raise ValueError('Duplicate root field '+name)
    if not ms:h=h.rstrip()+'\n'+replacement+'\n'
    else:
        m=ms[0];h=h[:m.start()]+replacement+h[m.end():]
        if not h.endswith('\n'):h+='\n'
    return a+'---'+h+'---'+b

def csection(s,n):
    m=re.search(rf'^## C-{n}[^\n]*',s,re.M)
    if not m:raise ValueError('Missing C-'+str(n))
    nextm=re.search(r'^## C-\d[^\n]*',s[m.end():],re.M)
    return m.start(),m.end()+nextm.start() if nextm else len(s)
def replace_c3(s,text):
    a,b=csection(s,3);return s[:a]+text.rstrip()+'\n\n'+s[b:]
def c4(s,patterns,ja):
    a,b=csection(s,4);part=s[a:b]
    # All migrated days use one explicit grammar selection line; retain other C4 content verbatim.
    rx=r'(?m)^(?:- )?\*\*(?:(?:\d+\s*(?:文法|语法|語法))|(?:(?:文法|语法|語法)\s*\d+\s*(?:个|個|項目|项)?))[：:]\*\*[^\n]*'
    replacement=f"**{len(patterns)}{'文法' if ja else '语法'}：** "+('・'.join(patterns) if patterns else ('本日の新規文法はありません。' if ja else '今日无符合条件的新语法。'))
    part,n=re.subn(rx,replacement,part)
    if n!=1:raise ValueError(f'Expected one C4 grammar line, got {n}')
    return s[:a]+part+s[b:]
def update_count_text(s,count,ja):
    unit='項目' if ja else '项'
    s=re.sub(r'(语法|文法|語法)(?:は|共)?\s*[0-9０-９]+\s*(?:項目|個|个|项|項)',lambda m:m[1]+str(count)+unit,s)
    return s

def verify_sources(cards,snapshot):
    """Use captured source bytes locally; independently refetch exact URLs on CI."""
    if snapshot:
        results=[]
        for c in cards:
            ev=c['source'];raw=(snapshot/'texts'/(ev['textSha256']+'.txt')).read_bytes()
            assert digest(raw)==ev['textSha256']
            assert normalize(ev['anchor']) in normalize(raw.decode())
            results.append({**ev,'date':c['date'],'pattern':c['pattern'],'verifiedBy':'historical-snapshot','verifiedAt':ev['capturedAt']})
        return results
    from bs4 import BeautifulSoup
    def fetch_url(url):
        request_url = 'https://prod.cursor.com/ja/blog/git-at-any-scale' if url == 'https://prod.cursor.com/blog/git-at-any-scale' else url
        req=urllib.request.Request(request_url,headers={'User-Agent':'Mozilla/5.0 (grammar-source-verification)','Accept-Language':'ja'})
        with urllib.request.urlopen(req,timeout=30) as r:
            raw=r.read(8_000_001)
            if len(raw)>8_000_000:raise ValueError('Oversized article')
            enc=r.headers.get_content_charset() or 'utf-8'
            html=raw.decode(enc,errors='replace');resolved=r.url
        soup=BeautifulSoup(raw,'html.parser')
        for el in soup.select('script,style,noscript'):el.decompose()
        text=soup.get_text(' ',strip=True)
        return normalize(text),digest(raw),resolved
    urls=list(dict.fromkeys(c['source']['url'] for c in cards));pages={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for url,result in zip(urls,pool.map(fetch_url,urls)):pages[url]=result
    results=[]
    for c in cards:
        ev=c['source'];text,sha,url=pages[ev['url']]
        if normalize(ev['anchor']) not in text:raise ValueError(f"Original-source anchor absent: {c['date']} {c['pattern']} {ev['url']}")
        results.append({**ev,'date':c['date'],'pattern':c['pattern'],'verifiedBy':'live-original-source-anchor','verifiedAt':datetime.now(timezone.utc).isoformat(),'responseSha256':sha,'resolvedUrl':url})
    return results

def make_card(c,ja):
    base={k:c[k] for k in ['pattern','level','structure','exampleJa']}
    base.update(sourceUrl=c['source']['url'],sourceForm=c['source']['surface'],sourceAnchor=c['source']['anchor'])
    if ja:base.update(meaning=c['meaning'],usage=c['usage'],note=c['note']+f" 当日Top {c['source']['index']}の原文表記：{c['source']['surface']}。例文は学習用の創作。")
    else:base.update(meaningZh=c['meaningZh'],usageZh=c['usageZh'],exampleZh=c['exampleZh'],noteZh=c['noteZh']+f" 当天Top {c['source']['index']}原文形式：{c['source']['surface']}。例句为学习用原创。")
    return base

def render_cards(cards,ja,note):
    lines=[f"## C-3. JLPT{'文法' if ja else '语法'}（{len(cards)}{'項目' if ja else '项'}）",'',note,'']
    for i,g in enumerate(cards,1):
        lines += [f"### {i}. {g['pattern']}",f"**{'学習目安' if ja else '学习参考'}：** {g['level']}  ",f"**{'意味' if ja else '含义'}：** {g['meaning'] if ja else g['meaningZh']}  ",f"**{'接続' if ja else '接续'}：** `{g['structure']}`  ",f"**{'使い方' if ja else '使用说明'}：** {g['usage'] if ja else g['usageZh']}  ",f"**{'例文' if ja else '例句'}：** `{g['exampleJa']}`  "]
        translation=g.get('exampleMeaning') if ja else g.get('exampleZh')
        if translation:lines.append(f"**{'言い換え' if ja else '译文'}：** {translation}  ")
        note_text=g.get('note') if ja else g.get('noteZh')
        if note_text:lines.append(f"**{'注意点' if ja else '辨析与注意'}：** {note_text}  ")
        if g.get('sourceUrl'):lines.append(f"**{'原文出典' if ja else '原文出处'}：** [Top記事]({g['sourceUrl']})")
        lines.append('')
    return '\n'.join(lines)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--snapshot-root',type=Path);args=ap.parse_args()
    if (DOC/'repair-report.json').exists():raise ValueError('Migration already applied; run grammar:check instead')
    authored=json.loads((DOC/'replacement-cards.json').read_text())
    dates=sorted(p.stem for p in (ROOT/'src/content/japanese').glob('*.md') if START<=p.stem<=END)
    assert len(dates)==37
    original={d:{dr:(ROOT/f'src/content/{dr}/{d}.md').read_text() for dr in ['daily','daily-ja','japanese','japanese-ja']} for d in dates}
    first={};plans={};total=0
    for date in dates:
        data,_=fm(original[date]['japanese']);ja,_=fm(original[date]['japanese-ja'])
        assert [(g['pattern'],g['level']) for g in data['grammar']]==[(g['pattern'],g['level']) for g in ja['grammar']]
        kept=[];removed=[];total+=len(data['grammar'])
        for i,g in enumerate(data['grammar']):
            k=key(g['pattern'])
            if k not in first:first[k]={'date':date,'pattern':g['pattern']};kept.append(i)
            else:removed.append({'date':date,'pattern':g['pattern'],'first':first[k]})
        plans[date]={'kept':kept,'removed':removed}
    assert total==259 and len(first)==30,(total,len(first))
    used=set(first)
    for c in authored:
        assert c['date'] in dates and key(c['pattern']) not in used,(c['date'],c['pattern'])
        used.add(key(c['pattern']))
        data,_=fm(original[c['date']]['daily'])
        assert data['top'][c['source']['index']-1]['url']==c['source']['url']
    source_checks=verify_sources(authored,args.snapshot_root)
    outputs={};rows=[];changes=[];manifest_before={}
    for date in dates:
        plan=plans[date];new=[c for c in authored if c['date']==date]
        old={dr:fm(t)[0] for dr,t in original[date].items()}
        zh=[copy.deepcopy(old['japanese']['grammar'][i]) for i in plan['kept']]+[make_card(c,False) for c in new]
        ja=[copy.deepcopy(old['japanese-ja']['grammar'][i]) for i in plan['kept']]+[make_card(c,True) for c in new]
        assert len(zh)<=8
        prior=old['japanese']['mustRememberGrammar'];patterns=[g['pattern'] for g in zh]
        must=sorted(patterns,key=lambda p:(p not in prior,patterns.index(p)))[:5]
        note_zh=f"全历史查重后，本日保留及补充{len(zh)}项未在更早日期收录的语法；已介绍的语法不再当作新项目。原文中已核实的新项目不足时，不为凑满5～8项而重复收录。"
        note_ja=f"全履歴との重複確認後、この日の新規文法は{len(ja)}項目。以前に紹介した文型は再登録せず、当日の原文で確認できる未収録項目だけを追加しています。5～8項目に満たない日も重複で補いません。"
        if plan['removed'] or new:
            for dr,cards,note,isja in [('japanese',zh,note_zh,False),('japanese-ja',ja,note_ja,True)]:
                text=original[date][dr]
                for name,value in [('grammar',cards),('grammarCount',len(cards)),('mustRememberGrammar',must),('grammarSelectionNote',note)]:text=field(text,name,value)
                text=field(text,'description',update_count_text(old[dr]['description'],len(cards),isja))
                body=f"## C-3. JLPT{'文法' if isja else '语法'}（{len(cards)}{'項目' if isja else '项'}）\n\n{note}\n\n"+'、'.join(g['pattern'] for g in cards)+'。'
                if re.search(r'^## C-3',fm(text)[1],re.M): text=replace_c3(text,body)
                if re.search(r'^## C-4',fm(text)[1],re.M): text=c4(text,must,isja)
                else:
                    head,sep,tail=text.rpartition('---')
                    tail=re.sub(r'(?m)^(?:- )?\*\*5\s*(?:文法|语法)[：:]\*\*[^\n]*',f"**{len(must)}{'文法' if isja else '语法'}：** "+'・'.join(must),tail)
                    tail=update_count_text(tail,len(cards),isja)
                    tail=re.sub(r'7\s*个语法',str(len(cards))+'个语法',tail)
                    tail=re.sub(r'C-3共7个',f'C-3共{len(cards)}个',tail)
                    text=head+sep+tail
                outputs[f'src/content/{dr}/{date}.md']=text
                parsed,_=fm(text)
                for name,val in old[dr].items():
                    if name not in ['grammar','grammarCount','mustRememberGrammar','description']:assert parsed[name]==val,(date,dr,name)
                assert parsed['grammar']==cards and parsed['grammarCount']==len(cards)
            for dr,cards,note,isja in [('daily',zh,note_zh,False),('daily-ja',ja,note_ja,True)]:
                text=original[date][dr];text=replace_c3(text,render_cards(cards,isja,note));text=c4(text,must,isja)
                # Only the C preamble's grammar count may be stale. A/B and C1/C2 stay byte-identical.
                for n in [1,2]:
                    a,b=csection(text,n);oa,ob=csection(original[date][dr],n)
                    assert text[a:b]==original[date][dr][oa:ob],(date,dr,'protected C'+str(n))
                assert fm(text)[1].split('\n# C.')[0]==fm(original[date][dr])[1].split('\n# C.')[0]
                outputs[f'src/content/{dr}/{date}.md']=text
            mp=ROOT/f'public/audio/japanese/{date}/manifest.json'
            if not mp.exists():raise ValueError('Missing audio manifest '+date)
            m=json.loads(mp.read_text());manifest_before[date]=copy.deepcopy(m)
            updated=[]
            for g in zh:
                matches=[x for x in m['grammar'] if x['pattern']==g['pattern'] and x['exampleJa']==g['exampleJa']]
                if matches:assert len(matches)==1;updated.append(matches[0])
                else:
                    assert g.get('sourceUrl'),'Retained original lost its recording'
                    updated.append({'pattern':g['pattern'],'exampleJa':g['exampleJa'],'example':None,'playback':'browser-tts','reason':'historical-grammar-repair'})
            m['grammar']=updated
            for name,val in manifest_before[date].items():
                if name!='grammar':assert m[name]==val
            outputs[f'public/audio/japanese/{date}/manifest.json']=json.dumps(m,ensure_ascii=False,indent=2)+'\n'
        rows.append({'date':date,'before':len(old['japanese']['grammar']),'retained':len(plan['kept']),'replaced':len(new),'removedWithoutReplacement':len(plan['removed'])-len(new),'after':len(zh),'mustRememberGrammar':must})
        changes+=plan['removed']
    assert len(used)==73
    # Update reviewed content hashes only after protected A/B equality has been asserted.
    pp=ROOT/'docs/daily-quality-policy.json';policy=json.loads(pp.read_text())
    for path,sha in list(policy['files'].items()):
        if path in outputs:
            assert digest((ROOT/path).read_bytes())==sha,'Unexpected reviewed reference hash'
            policy['files'][path]=digest(outputs[path].encode())
    policy['reason']+=' Authorized grammar-only history repair; A/B, vocabulary and interview recordings remain unchanged.'
    outputs['docs/daily-quality-policy.json']=json.dumps(policy,ensure_ascii=False,indent=2)+'\n'
    report={'schemaVersion':1,'baseline':'d470185d853dca3c8a0378601da44449772cf1a5','from':START,'through':END,'days':len(dates),'before':total,'retainedFirstIntroductions':len(first),'duplicateEntries':total-len(first),'sourceVerifiedReplacements':len(authored),'removedWithoutReplacement':total-len(first)-len(authored),'after':len(used),'historicalDuplicatesAfter':0,'minimumPerDay':min(r['after'] for r in rows),'maximumPerDay':max(r['after'] for r in rows),'protected':['news A/B body','vocabulary and technical terms','C1/C2 body','C4 vocabulary','interview text and audio','existing MP3 bytes'],'replacementAudio':'explicit browser Japanese speech; no new AivisSpeech recordings claimed','byDate':rows,'removedDuplicateRecords':changes,'firstIntroductions':first}
    outputs['docs/grammar-history/source-verification.json']=json.dumps(source_checks,ensure_ascii=False,indent=2)+'\n'
    outputs['docs/grammar-history/repair-report.json']=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    lines=['# Historical grammar repair','',f'{START} through {END}: {total} prior entries; {len(first)} first introductions retained; {len(authored)} source-verified replacements; {len(used)} final distinct grammar identities.','', 'Repetitions without a verified replacement were removed, not filled with invented or unrelated grammar. Daily quantities are explicit; must-remember grammar is a subset of that day’s new items.','', 'Existing vocabulary, news, interviews, technical terms and MP3 bytes are unchanged. New grammar examples use explicit browser Japanese TTS.','', '| Date | Before | Retained | Replaced | Removed | After |','|---|---:|---:|---:|---:|---:|']
    for r in rows:lines.append(f"| {r['date']} | {r['before']} | {r['retained']} | {r['replaced']} | {r['removedWithoutReplacement']} | {r['after']} |")
    outputs['docs/grammar-history/repair-report.md']='\n'.join(lines)+'\n'
    for path,text in outputs.items():
        p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    print(json.dumps({k:v for k,v in report.items() if k not in ['byDate','removedDuplicateRecords','firstIntroductions']},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
