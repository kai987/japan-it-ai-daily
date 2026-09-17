"""Offline, reviewed vocabulary migration. No fetching or model calls.
Only C-1/C-4 and their learning metadata may change. Other material is protected.
"""
from __future__ import annotations
import argparse, collections, csv, hashlib, json, lzma, re, subprocess
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DIRS = ('daily', 'daily-ja', 'japanese', 'japanese-ja')
END = '2026-09-17'
H1 = re.compile(r'^#{1,6}\s+C-1[.．][^\n]*\n', re.M)
H2 = re.compile(r'^#{1,6}\s+C-2[.．][^\n]*\n', re.M)
H4 = re.compile(r'^#{1,6}\s+C-4[.．][^\n]*\n', re.M)
SHORT = {
 'zh': '全历史去重后，本次从该日原文中可重新核实的合格新词不足18个；仅保留实际收录数，不以旧词或未经核实的摘要补齐。',
 'ja': '全履歴の重複を除いた後、当日の原文で今回再確認できた新出語が18語に満たないため、実数のみを掲載します。既出語や未確認の要約では補いません。'
}

def sha(text): return hashlib.sha256(text.encode('utf-8')).hexdigest()
def fm(source):
    match = re.match(r'^---\n([\s\S]*?)\n---(?:\n|$)', source)
    if not match: raise ValueError('Missing YAML frontmatter')
    return yaml.safe_load(match.group(1)), source[match.end():]

def replace_fields(source, values):
    match = re.match(r'^---\n([\s\S]*?)\n---(?:\n|$)', source)
    header = match.group(1) + '\n'
    for key, value in values.items():
        pattern = re.compile(r'^' + re.escape(key) + r':[\s\S]*?(?=^[A-Za-z][A-Za-z0-9_]*:|\Z)', re.M)
        block = yaml.safe_dump({key:value}, allow_unicode=True, sort_keys=False, width=10000)
        if pattern.search(header): header = pattern.sub(lambda _:block, header, count=1)
        else: header += block
    return '---\n' + header.rstrip('\n') + '\n---\n' + source[match.end():]

def identity_factory(items):
    config = json.loads((HERE/'identity-config.json').read_text())
    adj, suru = set(config['adjectiveStems']), set(config['suruStems'])
    import unicodedata
    clean=lambda s:re.sub(r'\s+','',unicodedata.normalize('NFKC',str(s)))
    for item in items:
        term=clean(item['term']);pos=item.get('partOfSpeech','')
        if 'な形容' in pos or '形容動詞' in pos:adj.add(re.sub('[なに]$','',term))
        if 'サ変' in pos and term.endswith('する'):suru.add(term[:-2])
    def identity(item):
        term=clean(item if isinstance(item,str) else item['term'])
        if term.endswith(('な','に')) and term[:-1] in adj:term=term[:-1]
        if term.endswith('する') and term[:-2] in suru:term=term[:-2]
        return config['aliases'].get(term,term)
    return identity

def cards(vocabulary, lang):
    chunks=[f'## C-1. JLPT語彙（{len(vocabulary)}語）' if lang=='ja' else f'## C-1. JLPT词汇（{len(vocabulary)}个）']
    if len(vocabulary)<18:chunks.append('> '+SHORT[lang])
    for i,v in enumerate(vocabulary,1):
        chunks.append(f"### {i}. {v['term']}（{v['reading']}）")
        if lang=='zh':
            fields=[('词性',v['partOfSpeech']),('中文',v['meaningZh']),('学习参考等级',v['level']),('搭配',' / '.join(v['collocations'])),('出处与语境',v['noteZh']),('原创例句',v['exampleJa']),('例句中文',v.get('exampleZh','')),('语感',v.get('nuanceZh',''))]
        else:
            fields=[('品詞',v['partOfSpeech']),('意味',v['meaning']),('学習上の目安',v['level']),('コロケーション',' / '.join(v['collocations'])),('出典と文脈',v['note']),('学習用例文',v['exampleJa']),('例文の説明',v.get('exampleMeaning','')),('ニュアンス',v.get('nuance',''))]
        chunks.append('  \n'.join(f'**{label}：** {value}' for label,value in fields if value))
    return '\n\n'.join(chunks)+'\n\n'

def protected(source):
    _,body=fm(source)
    a,b,c=H1.search(body),H2.search(body),H4.search(body)
    return (body[:a.start()] if a else None,body[b.start():c.start()] if b and c else None)

def modify_body(source,vocabulary,words,lang,required):
    data,body=fm(source)
    a,b=H1.search(body),H2.search(body)
    if required and not (a and b):raise ValueError('Daily missing C-1/C-2')
    if a and b:body=body[:a.start()]+cards(vocabulary,lang)+body[b.start():]
    c=H4.search(body)
    if required and not c:raise ValueError('Daily missing C-4')
    if c:
        tail=body[c.end():]
        grammar=re.search(r'^(?:#{1,6}\s+[^\n]*(?:语法|語法|文法)|\*\*[^\n]*(?:语法|語法|文法)[^\n]*\*\*)',tail,re.M)
        if not grammar:raise ValueError('C-4 grammar boundary not found')
        label='重点词' if lang=='zh' else '重点語'
        body=body[:c.end()]+'\n'+f'**{len(words)}{label}：** '+'・'.join(words)+'\n\n'+tail[grammar.start():]
    end=re.match(r'^---\n[\s\S]*?\n---(?:\n|$)',source).end()
    return source[:end]+body

def select_words(old,vocab):
    allowed={v['term'] for v in vocab};selected=[w for w in old if w in allowed]
    target=min(10,len(vocab));selected=selected[:target]
    groups=collections.defaultdict(list)
    for v in vocab:
        if v['term'] in selected:continue
        pos=v['partOfSpeech'];group='verb' if '動詞' in pos else 'adjective' if '形容' in pos else 'adverb' if '副詞' in pos else 'other'
        groups[group].append(v['term'])
    while len(selected)<target:
        for group in ('verb','adjective','adverb','other'):
            if groups[group] and len(selected)<target:selected.append(groups[group].pop(0))
    return selected

def load_reviewed():
    path=HERE/'replacements.json'
    if path.exists():return json.loads(path.read_text())
    parts=sorted((HERE/'data').glob('reviewed-*.part'))
    spec=json.loads((HERE/'data/manifest.json').read_text())
    if len(parts)!=spec['parts']:raise ValueError('Reviewed data parts missing')
    raw=b''.join(p.read_bytes() for p in parts)
    if hashlib.sha256(raw).hexdigest()!=spec['sha256']:raise ValueError('Reviewed payload checksum mismatch')
    decoder=lzma.LZMADecompressor(memlimit=128*1024*1024)
    data=decoder.decompress(raw,max_length=2000001)
    if len(data)>2000000 or not decoder.eof or decoder.unused_data:raise ValueError('Invalid reviewed data archive')
    table=json.loads(data)
    if len(table)!=spec['records']:raise ValueError('Reviewed record count mismatch')
    records=[]
    for row in table:
        if len(row)!=16:raise ValueError('Reviewed column count mismatch')
        d,rank,surface,term,reading,pos,level,zh,ja,collocs,example,translation,nzh,nja,notezh,noteja=row
        top=fm((ROOT/f'src/content/daily/{d}.md').read_text())[0]['top'][rank-1]
        common={'term':term,'reading':reading,'partOfSpeech':pos,'level':level,'collocations':collocs,'exampleJa':example}
        records.append({'date':d,'sourceRank':rank,'sourceUrl':top['url'],'sourceTitle':top['title'],'sourceForm':surface,
            'zh':{**common,'meaningZh':zh,'noteZh':notezh,'exampleZh':translation,'nuanceZh':nzh},
            'ja':{**common,'meaning':ja,'note':noteja,'nuance':nja}})
    return records

def load_baseline():
    path=HERE/'baseline.json'
    if path.exists():return json.loads(path.read_text())
    commit='28d10dd08b3c70cb6c4773f6b290c344114e6113'
    result={}
    for collection in DIRS:
        for file in sorted((ROOT/'src/content'/collection).glob('*.md')):
            if not re.fullmatch(r'2026-\d{2}-\d{2}',file.stem) or file.stem>END:continue
            relative=str(file.relative_to(ROOT))
            original=subprocess.run(['git','show',f'{commit}:{relative}'],cwd=ROOT,check=True,capture_output=True).stdout.decode('utf-8')
            result[relative]=sha(original)
    if len(result)!=148:raise ValueError('Baseline does not contain 148 scoped files')
    return result

def migrate():
    baseline=load_baseline()
    report_path=ROOT/'docs/jlpt-history/repair-2026-09-18.json'
    if report_path.exists():
        prior=json.loads(report_path.read_text())
        if all(sha((ROOT/p).read_text())==value for p,value in prior['outputHashes'].items()):
            print('Already applied; output hashes verified.');return
        raise ValueError('Existing repair report differs: refusing a second migration')
    sources={p:(ROOT/p).read_text() for p in baseline}
    for p,s in sources.items():
        if sha(s)!=baseline[p]:raise ValueError(f'Baseline changed: {p}')
    dates=sorted({Path(p).stem for p in sources if '/japanese/' in p})
    if len(dates)!=37 or dates[0]!='2026-08-12' or dates[-1]!=END:raise ValueError('Unexpected historical coverage')
    data={d:{c:fm(sources[f'src/content/{c}/{d}.md'])[0] for c in DIRS} for d in dates}
    records=load_reviewed()
    items=[v for day in data.values() for v in day['japanese']['vocabulary']]
    ident=identity_factory(items+[r['zh'] for r in records])
    reserved={ident(v) for v in items};chosen=set();replacements=collections.defaultdict(list)
    for r in records:
        d=r['date'];key=ident(r['zh'])
        if key in reserved or key in chosen:raise ValueError(f'Non-new candidate: {d} {key}')
        chosen.add(key)
        top=data[d]['daily']['top'][r['sourceRank']-1]
        if top['url']!=r['sourceUrl'] or not r['sourceForm']:raise ValueError('Replacement provenance mismatch')
        for field in ('term','reading','partOfSpeech','level','collocations','exampleJa'):
            if r['zh'][field]!=r['ja'][field]:raise ValueError('Bilingual replacement mismatch')
        for lang,required in [('zh',['meaningZh','noteZh','exampleZh','nuanceZh']),('ja',['meaning','note','nuance'])]:
            if any(not r[lang].get(k) for k in required) or not 2<=len(r[lang]['collocations'])<=4:raise ValueError('Incomplete detailed card')
        replacements[d].append(r)
    first={};rows=[];new_sources=dict(sources);first_proofs=[];total_before=total_duplicates=total_added=0
    for d in dates:
        z,j=data[d]['japanese'],data[d]['japanese-ja']
        if [v['term'] for v in z['vocabulary']]!=[v['term'] for v in j['vocabulary']]:raise ValueError(f'Original languages differ: {d}')
        queue=list(replacements[d]);new_z=[];new_j=[];changes=[];kept=[]
        for index,v in enumerate(z['vocabulary']):
            total_before+=1;k=ident(v)
            if k not in first:
                first[k]={'date':d,'term':v['term']};new_z.append(v);new_j.append(j['vocabulary'][index]);kept.append(v['term'])
                first_proofs.append({'identity':k,'date':d,'term':v['term'],'zhSha256':sha(json.dumps(v,ensure_ascii=False,sort_keys=True)),'jaSha256':sha(json.dumps(j['vocabulary'][index],ensure_ascii=False,sort_keys=True))})
                continue
            total_duplicates+=1
            change={'oldTerm':v['term'],'identity':k,'firstDate':first[k]['date'],'firstTerm':first[k]['term']}
            if queue:
                r=queue.pop(0);new_z.append(r['zh']);new_j.append(r['ja']);total_added+=1
                change.update(action='replace',newTerm=r['zh']['term'],sourceRank=r['sourceRank'],sourceUrl=r['sourceUrl'],sourceForm=r['sourceForm'])
            else:change.update(action='remove-duplicate',reason='No additional reviewed replacement allocated; never pad with an old word.')
            changes.append(change)
        if queue:raise ValueError(f'Too many replacements: {d}')
        words=select_words(z['mustRememberWords'],new_z)
        row={'date':d,'before':len(z['vocabulary']),'keptFirstOccurrences':len(kept),'replaced':sum(x['action']=='replace' for x in changes),'removed':sum(x['action']=='remove-duplicate' for x in changes),'after':len(new_z),'changes':changes,'mustRememberWords':words}
        if len(new_z)<18:row['shortfallReason']=SHORT['zh']
        rows.append(row)
        if not changes:continue
        for c in DIRS:
            p=f'src/content/{c}/{d}.md';source=sources[p];lang='ja' if c.endswith('-ja') else 'zh';vocab=new_j if lang=='ja' else new_z
            if c.startswith('japanese'):
                desc=data[d][c]['description']
                desc=re.sub(r'(?:JLPT\s*(?:词汇|語彙)|通用词|汎用語彙|語彙)\s*\d+\s*(?:个|語)', lambda m:re.sub(r'\d+',str(len(vocab)),m.group()),desc)
                desc=re.sub(r'\d+\s*(?:个|語)(?=[^。]*?(?:词汇|語彙))',lambda m:re.sub(r'\d+',str(len(vocab)),m.group()),desc)
                # Explicit true count even where older prose used a different description format.
                suffix=f' 全历史去重后JLPT新词{len(vocab)}个。' if lang=='zh' else f' 全履歴で重複を除いた新出語は{len(vocab)}語です。'
                values={'vocabulary':vocab,'vocabularyCount':len(vocab),'mustRememberWords':words,'description':desc+suffix}
                if len(vocab)<18:values['vocabularyShortfallReason']=SHORT[lang]
                source=replace_fields(source,values)
            source=modify_body(source,vocab,words,lang,c.startswith('daily'))
            if protected(source)!=protected(sources[p]):raise ValueError(f'Protected A/B/C2/C3 changed: {p}')
            orig,new=fm(sources[p])[0],fm(source)[0]
            for key in ('grammar','technicalTerms','mustRememberGrammar','top','date'):
                if orig.get(key)!=new.get(key):raise ValueError(f'Protected metadata changed: {p}:{key}')
            new_sources[p]=source
    seen=set()
    for d in dates:
        z,j=[fm(new_sources[f'src/content/{c}/{d}.md'])[0] for c in ('japanese','japanese-ja')]
        if z['vocabularyCount']!=len(z['vocabulary']):raise ValueError('Count mismatch')
        if z['mustRememberWords']!=j['mustRememberWords']:raise ValueError('Selection mismatch')
        for v in z['vocabulary']:
            k=ident(v)
            if k in seen:raise ValueError(f'Post-repair duplicate: {d} {k}')
            seen.add(k)
    if len(seen)!=len(reserved)+len(records):raise ValueError('Final unique count mismatch')
    out=ROOT/'docs/jlpt-history';out.mkdir(parents=True,exist_ok=True)
    report={'version':1,'repairedAtJST':'2026-09-18','range':{'from':dates[0],'to':dates[-1]},'days':len(dates),'before':total_before,'duplicateOccurrences':total_duplicates,'keptUniqueOriginals':len(reserved),'verifiedReplacements':total_added,'removedUnfilledDuplicateSlots':total_duplicates-total_added,'after':len(seen),'remainingDuplicates':0,'policy':'Earliest lexical occurrence retained. Replacements must come from the same day original Top 5. No old-word padding. JLPT levels are learning estimates.','dayResults':rows,'firstOccurrenceProofs':first_proofs,'inputHashes':baseline,'outputHashes':{p:sha(s) for p,s in new_sources.items()}}
    for p,source in new_sources.items():
        if source!=sources[p]:(ROOT/p).write_text(source)
    report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    with (out/'changes-2026-09-18.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.writer(f);writer.writerow(['date','oldTerm','firstDate','firstTerm','action','newTerm','sourceUrl','sourceForm'])
        for row in rows:
            for change in row['changes']:writer.writerow([row['date'],change['oldTerm'],change['firstDate'],change['firstTerm'],change['action'],change.get('newTerm',''),change.get('sourceUrl',''),change.get('sourceForm','')])
    (out/'README.md').write_text('# JLPT history repair — 2026-09-18\n\n'+f'{total_before} original slots; {total_duplicates} later duplicates; {total_added} source-checked replacements; {len(seen)} unique final cards.\n\n'+'The earliest cards, A/B news, interview Q&A, technical terms, grammar and source selections are preserved. Detailed audit and source forms are in `repair-2026-09-18.json` and `changes-2026-09-18.csv`.\n\n'+'Some days contain fewer than 18 new words because the available reverified originals did not supply enough reviewed candidates. This is explicit, not filled with old words. Levels are learning estimates, not an official JLPT vocabulary list.\n\n'+'Audio: existing clips are selected only by exact term/reading or sentence identity. Unmatched new cards use the existing browser Japanese-speech fallback; this repair does not claim to have regenerated AivisSpeech/R2 MP3s.\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('dayResults','firstOccurrenceProofs','inputHashes','outputHashes')},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--apply',action='store_true',required=True);parser.parse_args();migrate()
