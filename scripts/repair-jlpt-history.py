"""One-time, source-attested 2026-08-12..09-17 vocabulary migration.

Only C-1 vocabulary, C-4 words and matching learning audio metadata are changed.
Run on a clean baseline checkout. A completed migration is verified, not reapplied.
"""
from __future__ import annotations
import argparse, copy, hashlib, json, re, unicodedata
from collections import Counter, defaultdict
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs/jlpt-history'
BASELINE = '28d10dd08b3c70cb6c4773f6b290c344114e6113'
START, END = '2026-08-12', '2026-09-17'
RULES = json.loads((DOC/'identity-rules.json').read_text())
ALIASES, NA = RULES['aliases'], set(RULES['naStems'])
def key(term):
    term = re.sub(r'[\s\u200b\ufeff]+', '', unicodedata.normalize('NFKC', term))
    term = ALIASES.get(term, term)
    if term.endswith('する'): term = term[:-2]
    if term.endswith(('な','に')) and (term[:-1] in NA or term[-2:-1]=='的'): term=term[:-1]
    return ALIASES.get(term, term)
def fm(source):
    parts=source.split('---',2)
    if len(parts)!=3 or parts[0].strip(): raise ValueError('Malformed frontmatter')
    return yaml.safe_load(parts[1]),parts[2]
def field(source,name,value):
    a,head,body=source.split('---',2)
    replacement=yaml.safe_dump({name:value},allow_unicode=True,sort_keys=False,width=10000).rstrip('\n')
    pattern=rf'(?m)^{re.escape(name)}:[^\n]*(?:\n(?![A-Za-z][\w-]*:)[^\n]*)*'
    matches=list(re.finditer(pattern,head))
    if len(matches)!=1:raise ValueError(f'Expected one YAML root field {name}, got {len(matches)}')
    m=matches[0];head=head[:m.start()]+replacement+head[m.end():]
    return a+'---'+head+'---'+body

def section(source,n):
    m=re.search(rf'^## C-{n}[^\n]*',source,re.M)
    if not m:return None
    nxt=re.search(r'^## (?!C-'+str(n)+r'\b)',source[m.end():],re.M)
    return m.start(),m.end()+nxt.start() if nxt else len(source)
def old_segments(source,count):
    a,b=section(source,1);text=source[a:b]
    starts=[m.start() for m in re.finditer(r'^### (?:C-1-)?\d+\. ',text,re.M)]
    if not starts:starts=[m.start() for m in re.finditer(r'^\d+\. \*\*',text,re.M)]
    if len(starts)!=count:raise ValueError(f'C1 segment count: {len(starts)} != {count}')
    return [text[a:b].strip() for a,b in zip(starts,starts[1:]+[len(text)])]
def renumber(text,i,card):
    if text.startswith('### '):return re.sub(r'^### (?:C-1-)?\d+\. ',f'### {i}. ',text,count=1)
    return f"### {i}. {card['term']}（{card['reading']}）\n"+re.sub(r'^\d+\. ', '', text,count=1)
def grammar_lines(source):
    return [l for l in source.splitlines() if re.search(r'\*\*(?:5\s*(?:文法|语法)|(?:文法|语法)\s*5)',l)]
def update_word_line(source,words,required=False):
    pattern=r'(?m)^((?:- )?\*\*(?:10\s*(?:語|词)|词汇\s*10\s*个|語彙\s*10\s*語)[：:]\*\*\s*)[^\n]*'
    found=re.findall(pattern,source)
    if required and len(found)!=1:raise ValueError(f'C4 word line count: {len(found)}')
    return re.sub(pattern,lambda m:m[1]+'・'.join(words),source)
def category(v):
    pos=v['partOfSpeech']
    if '動詞' in pos or 'サ変' in pos:return 'verb'
    if '形容' in pos:return 'adjective'
    if any(t in pos for t in ['副詞','接続詞','連体詞','慣用']):return 'adverb'
    return 'noun'
def must_remember(cards,old):
    # Prefer still-valid existing choices, then fill a varied ten-word selection.
    prior=set(old); ranked=sorted(enumerate(cards),key=lambda x:(x[1]['term'] not in prior,x[0]))
    result=[]
    for cat,limit in [('verb',4),('adjective',2),('adverb',2),('noun',2)]:
        result += [v['term'] for _,v in ranked if category(v)==cat][:limit]
    for _,v in ranked:
        if len(result)==10:break
        if v['term'] not in result:result.append(v['term'])
    assert len(result)==10 and len(set(result))==10
    return result

FIELDS='term reading partOfSpeech level meaningZh meaningJa collocations usageZh usageJa exampleJa exampleZh nuanceZh nuanceJa'.split()
def inputs():
    cards=defaultdict(list);date=None
    for line in (DOC/'replacement-cards.tsv').read_text().splitlines():
        if line.startswith('@'):date=line[1:];continue
        values=line.split('|')
        if len(values)!=13 or not all(values) or date is None:raise ValueError('Invalid authored TSV row')
        c=dict(zip(FIELDS,values));c['collocations']=c['collocations'].split(';');cards[date].append(c)
    return cards,json.loads((DOC/'source-attestations.json').read_text())
def new_card(date,c,ja,evidence):
    ref=evidence['cards'][date+'/'+c['term']];source=evidence['sources'][ref['article']]
    idx=int(ref['article'].rsplit('/',1)[1]);form=ref['surface']
    common={k:copy.deepcopy(c[k]) for k in ['term','reading','partOfSpeech','level','collocations','exampleJa']}
    if ja:common.update(meaning=c['meaningJa'],note=f"当日Top {idx}の原文表記「{form}」。{c['usageJa']}",nuance=c['nuanceJa'])
    else:common.update(meaningZh=c['meaningZh'],noteZh=f"当天Top {idx}原文形式「{form}」。{c['usageZh']}",exampleZh=c['exampleZh'],nuanceZh=c['nuanceZh'])
    return common

def render_card(i,v,date,ja,evidence):
    lines=[f"### {i}. {v['term']}（{v['reading']}）"]
    if ja:
        lines += [f"**品詞：** {v['partOfSpeech']}｜**学習目安：** {v['level']}  ",f"**意味：** {v['meaning']}  ",f"**コロケーション：** {' / '.join(v['collocations'])}  ",f"**使い方：** {v['note']}  ",f"**オリジナル例文：** {v['exampleJa']}  ",f"**ニュアンス：** {v['nuance']}  "]
    else:
        lines += [f"**词性：** {v['partOfSpeech']}｜**学习参考：** {v['level']}  ",f"**中文：** {v['meaningZh']}  ",f"**常见搭配：** {' / '.join(v['collocations'])}  ",f"**用法：** {v['noteZh']}  ",f"**原创例句：** {v['exampleJa']}  ",f"**例句翻译：** {v['exampleZh']}  ",f"**语感与区别：** {v['nuanceZh']}  "]
    ref=evidence['cards'][date+'/'+v['term']];s=evidence['sources'][ref['article']]
    lines += [f"**{'原文の出典' if ja else '原文出处'}：** [Top {ref['article'].split('/')[-1]}]({s['url']})"]
    return '\n'.join(lines)

def verify_final():
    seen={};counts=[]
    for p in sorted((ROOT/'src/content/japanese').glob('*.md')):
        if not START<=p.stem<=END:continue
        zh,_=fm(p.read_text());ja,_=fm((ROOT/'src/content/japanese-ja'/p.name).read_text())
        assert len(zh['vocabulary'])==20==len(ja['vocabulary'])
        assert [v['term'] for v in zh['vocabulary']]==[v['term'] for v in ja['vocabulary']]
        assert zh['mustRememberWords']==ja['mustRememberWords']
        assert len(zh['mustRememberWords'])==10 and set(zh['mustRememberWords'])<=set(v['term'] for v in zh['vocabulary'])
        for v in zh['vocabulary']:
            k=key(v['term']);assert k not in seen,(p.stem,v['term'],seen.get(k));seen[k]=p.stem
        counts.append(p.stem)
    assert len(counts)==37 and len(seen)==740
    return seen

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--audio-root',type=Path,default=ROOT/'public/audio/japanese');args=parser.parse_args()
    reportpath=DOC/'repair-report.json'
    if reportpath.exists():
        verify_final();print('Already applied: all 37 days verified; no changes.');return
    authored,evidence=inputs();seen={};old_total=0;retained_count=0;new_count=0;removed=[];dayrows=[];protected=[]
    originals={}
    dates=sorted(p.stem for p in (ROOT/'src/content/japanese').glob('*.md') if START<=p.stem<=END)
    assert len(dates)==37
    for date in dates:
        originals[date]={d:(ROOT/f'src/content/{d}/{date}.md').read_text() for d in ['daily','daily-ja','japanese','japanese-ja']}
    # All originals loaded before any write; retain every first occurrence in date order.
    plans={};allfirst=set()
    for date in dates:
        zh,_=fm(originals[date]['japanese']);old_total+=len(zh['vocabulary']);plan=[]
        for idx,v in enumerate(zh['vocabulary']):
            k=key(v['term'])
            if k not in seen:
                seen[k]=date;allfirst.add(k);plan.append(('keep',idx));retained_count+=1
            else:plan.append(('replace',idx))
        plans[date]=plan
    assert old_total==744 and retained_count==391
    newkeys=[]
    for date,cards in authored.items():
        daily,_=fm(originals[date]['daily'])
        for c in cards:
            k=key(c['term']);assert k not in allfirst and k not in newkeys,(date,c['term']);newkeys.append(k)
            ref=evidence['cards'][date+'/'+c['term']];s=evidence['sources'][ref['article']]
            assert ref['article'].startswith(date+'/')
            assert daily['top'][int(ref['article'].split('/')[-1])-1]['url']==s['url']
            assert ref['surface'] and ref['offset']>=0 and re.fullmatch(r'[0-9a-f]{64}',s['textSha256'])
    assert len(newkeys)==349
    outputs={};audio_outputs={}
    for date in dates:
        old={lang:fm(s)[0] for lang,s in originals[date].items()};zh_old=old['japanese']['vocabulary'];ja_old=old['japanese-ja']['vocabulary']
        assert [v['term'] for v in zh_old]==[v['term'] for v in ja_old]
        replacements=iter(authored.get(date,[]));zhs=[];jas=[];slots=[];dayremoved=[]
        for kind,idx in plans[date]:
            if kind=='keep':
                zhs.append(copy.deepcopy(zh_old[idx]));jas.append(copy.deepcopy(ja_old[idx]));slots.append((kind,idx));continue
            c=next(replacements,None);oldterm=zh_old[idx]['term']
            row={'date':date,'oldTerm':oldterm,'firstDate':seen[key(oldterm)],'replacement':c['term'] if c else None}
            if c:
                zhs.append(new_card(date,c,False,evidence));jas.append(new_card(date,c,True,evidence));slots.append(('replace',idx));new_count+=1
                row['source']=evidence['cards'][date+'/'+c['term']]
            dayremoved.append(row);removed.append(row)
        assert next(replacements,None) is None and len(zhs)==20
        words=must_remember(zhs,old['japanese']['mustRememberWords']) if dayremoved else old['japanese']['mustRememberWords']
        for lang,cards in [('japanese',zhs),('japanese-ja',jas)]:
            source=originals[date][lang]
            if dayremoved:
                source=field(source,'vocabulary',cards);source=field(source,'vocabularyCount',20);source=field(source,'mustRememberWords',words)
                data,body=fm(source)
                # Counts in descriptions must agree, without touching other facts.
                desc=re.sub(r'\b(?:21|22)(?=\s*(?:个|語|词|項目))','20',data['description'])
                if desc!=data['description']:source=field(source,'description',desc)
                head,body=source.rsplit('---',1)
                body=update_word_line(body,words)
                body=re.sub(r'\b(?:21|22)(?=\s*个通用词汇)','20',body)
                sec=section(body,1)
                if sec:
                    a,b=sec;body=body[:a]+('## C-1. JLPT語彙\n全20語：' if lang.endswith('-ja') else '## C-1. JLPT词汇\n共20词：')+'、'.join(v['term'] for v in cards)+'。\n\n'+body[b:]
                source=head+'---'+body
            outputs[f'src/content/{lang}/{date}.md']=source
            data,_=fm(source)
            for k in ['grammar','technicalTerms','mustRememberGrammar','grammarCount']:
                assert data[k]==old[lang][k],(date,lang,'protected',k)
            for (kind,idx),v in zip(slots,cards):
                if kind=='keep':assert v==(ja_old if lang.endswith('-ja') else zh_old)[idx]
        for lang,cards in [('daily',zhs),('daily-ja',jas)]:
            source=originals[date][lang];ja=lang.endswith('-ja')
            if dayremoved:
                segs=old_segments(source,len(zh_old));rendered=[]
                for i,((kind,idx),v) in enumerate(zip(slots,cards),1):
                    rendered.append(renumber(segs[idx],i,v) if kind=='keep' else render_card(i,v,date,ja,evidence))
                a,b=section(source,1)
                intro='全20語。過去の収録語と照合済み。JLPTレベルは学習上の目安です。' if ja else '共20词，已与全部历史收录词核对。JLPT等级为学习参考。'
                c1=('## C-1. JLPT語彙（20語）' if ja else '## C-1. JLPT词汇（20个）')+'\n\n'+intro+'\n\n'+'\n\n'.join(rendered)+'\n\n'
                source=source[:a]+c1+source[b:]
                a,b=section(source,4);c4=update_word_line(source[a:b],words,required=True)
                # Old Sep 8 word-class count is specific to the replaced vocabulary.
                c4=re.sub(r'(?m)^.*(?:名词|名詞).*(?:动词|動詞).*(?:副词|副詞).*$', '品詞が偏らないよう、上の20語から選んでいます。' if ja else '从上方20词中精选，兼顾不同词性。',c4)
                source=source[:a]+c4+source[b:]
                olddata,_=fm(originals[date][lang]);newdata,_=fm(source)
                # Only vocabulary counts in the description may change.
                desc=re.sub(r'\b(?:21|22)(?=\s*(?:个|語|词))','20',newdata['description'])
                if desc!=newdata['description']:source=field(source,'description',desc)
                assert source[:section(source,1)[0]]==originals[date][lang][:section(originals[date][lang],1)[0]],(date,lang,'A/B changed')
                for n in [2,3]:
                    x,y=section(source,n);u,v=section(originals[date][lang],n)
                    assert source[x:y]==originals[date][lang][u:v],(date,lang,'C2/C3 changed')
                assert grammar_lines(source)==grammar_lines(originals[date][lang]),(date,lang,'C4 grammar changed')
            outputs[f'src/content/{lang}/{date}.md']=source
        # Keep old recording filenames and hashes for unchanged words, not their ordinal slots.
        p=args.audio_root/date/'manifest.json';manifest=json.loads(p.read_text());oldmanifest=copy.deepcopy(manifest)
        if dayremoved:
            olditems={(x['term'],x['reading'],x['exampleJa']):x for x in manifest['items']};items=[]
            for i,((kind,idx),v) in enumerate(zip(slots,zhs),1):
                ident=(v['term'],v['reading'],v['exampleJa'])
                if kind=='keep':
                    x=copy.deepcopy(olditems[ident]);x['index']=i
                else:x={'index':i,'term':v['term'],'reading':v['reading'],'exampleJa':v['exampleJa'],'playback':'browser-tts','reason':'historical-jlpt-repair','word':None,'example':None}
                items.append(x)
            manifest['items']=items
            manifest['contentRevision']='jlpt-history-dedup-2026-09-18'
            manifest['browserTtsCount']=sum(x.get('playback')=='browser-tts' for x in items)
            assert manifest['grammar']==oldmanifest['grammar'] and manifest['generatedAt']==oldmanifest['generatedAt']
            audio_outputs[f'public/audio/japanese/{date}/manifest.json']=json.dumps(manifest,ensure_ascii=False,indent=2)+'\n'
        dayrows.append({'date':date,'before':len(zh_old),'retained':sum(k=='keep' for k,_ in plans[date]),'replaced':sum(x['replacement'] is not None for x in dayremoved),'removedWithoutReplacement':sum(x['replacement'] is None for x in dayremoved),'after':20,'mustRememberWords':words})
    assert new_count==349 and len(removed)==353
    # All validations above happen before modifying even one lesson.
    for path,text in {**outputs,**audio_outputs}.items():
        p=ROOT/path;p.parent.mkdir(parents=True,exist_ok=True)
        if not p.exists() or p.read_text()!=text:p.write_text(text)
    verify_final()
    report={'schemaVersion':1,'baseline':BASELINE,'from':START,'through':END,'days':37,'beforeCards':744,'retainedFirstCards':391,'duplicateEntries':353,'newSourceAttestedCards':349,'droppedDuplicateSlots':4,'afterCards':740,'uniqueLexicalIdentities':740,'historicalDuplicatesAfter':0,'protected':{'firstOccurrenceCardFields':'unchanged in both languages','newsAndInterviewSections':'byte-identical','technicalTermsAndGrammar':'unchanged','mustRememberGrammar':'unchanged','existingRecordingAudioBytes':'not modified','newVocabularyPlayback':'browser Japanese TTS; no new AivisSpeech recordings claimed'},'byDate':dayrows,'changes':removed}
    reportpath.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    lines=['# JLPT historical vocabulary repair','',f'Baseline: `{BASELINE}`. Period: {START}–{END} (37 days).','', '| Check | Result |','|---|---:|','| Cards before | 744 |','| First-occurrence cards preserved | 391 |','| Later duplicate entries | 353 |','| New source-attested bilingual cards | 349 |','| Extra duplicate slots removed | 4 |','| Cards after | 740 |','| Canonical lexical duplicates after | 0 |','', 'A/B news and interview sections are byte-identical. C-2, C-3 and C-4 grammar are unchanged. Source references and token positions are in `source-attestations.json`; full third-party article copies are not published.','', '**Audio:** retained words keep their existing recorded assets. The 349 new cards explicitly use browser Japanese speech synthesis for word and example playback. No new AivisSpeech recordings have been generated by this repair.','', '## By date','','| Date | Before | Preserved | Replaced | Removed extra | After |','|---|---:|---:|---:|---:|---:|']
    for r in dayrows:lines.append(f"| {r['date']} | {r['before']} | {r['retained']} | {r['replaced']} | {r['removedWithoutReplacement']} | 20 |")
    (DOC/'repair-report.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['byDate','changes']},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
