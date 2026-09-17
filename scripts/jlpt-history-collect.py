"""Read-only source collector for the JLPT history repair. Never modifies lessons."""
from __future__ import annotations
import concurrent.futures, hashlib, json, re, sys, threading, unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import requests, yaml
from bs4 import BeautifulSoup
from janome.tokenizer import Tokenizer
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/jlpt-originals')
OUT.mkdir(parents=True,exist_ok=True)
local=threading.local();locks={};lock=threading.Lock()
def readfm(p):
    return yaml.safe_load(p.read_text(encoding='utf-8').split('---',2)[1])
def hira(s):
    return ''.join(chr(ord(c)-96) if 'ァ'<=c<='ヶ' else c for c in s)
def norm(s):
    return re.sub(r'\s+','',unicodedata.normalize('NFKC',s))
old=set()
for p in (ROOT/'src/content/japanese').glob('*.md'):
    for v in readfm(p).get('vocabulary',[]):
        t=norm(v['term']);old.add(t)
        if t.endswith('する'):old.add(t[:-2])
        if any(x in v.get('partOfSpeech','') for x in ['形容動詞','な形容詞','ナ形容詞']):
            if t.endswith(('な','に')):old.add(t[:-1])
stop={'する','ある','いる','なる','れる','られる','せる','させる','できる','出来る','いう','言う','思う','見る','使う','行う','くる','来る','いく','行く','ところ','こちら','これ','それ','あれ','ため','もの','こと','よう','ここ','そこ','ほう','わけ','とき','まま','方','人','場合','今回','今日','日本','記事','サービス','システム','データ','モデル','コード','ユーザー','ツール','エージェント','アプリ','ソフトウェア','株式会社','ブログ','エンジニア','コメント','ブックマーク','シェア','関連','カテゴリ','タグ','続きを読む','ニュース','メニュー','ログイン','ログアウト','メール','サイト','ページ','一覧','目次','名前','ホーム','人気','新着','タイトル'}
def collect(item):
    url=item['url'];host=urlparse(url).hostname or ''
    with lock: sem=locks.setdefault(host,threading.Semaphore(2))
    result={**item,'capturedAt':datetime.now(timezone.utc).isoformat()}
    try:
        if not url.startswith('https://'):raise ValueError('HTTPS article URL required')
        with sem:
            response=requests.get(url,headers={'User-Agent':'Mozilla/5.0','Accept-Language':'ja,en;q=0.7'},timeout=(8,25))
        result.update(status=response.status_code,resolvedUrl=response.url)
        response.raise_for_status()
        if 'text/html' not in response.headers.get('Content-Type',''):raise ValueError('Not an HTML article')
        if response.encoding and response.encoding.lower()=='iso-8859-1':response.encoding='utf-8'
        soup=BeautifulSoup(response.text,'html.parser')
        result['htmlTitle']=soup.title.get_text(' ',strip=True) if soup.title else ''
        root=(soup.select_one('.entry-content') or soup.select_one('.znc') or soup.select_one('.zenn-article') or soup.find('article') or soup.find('main'))
        if root is None:raise ValueError('No article/main content node; manual review needed')
        for node in root.select('script,style,noscript,nav,footer,header,aside,form,svg,pre,code,.related-articles,.article-tags'):
            node.decompose()
        text=re.sub(r'\n{3,}','\n\n',root.get_text('\n',strip=True))
        if len(text)<300:raise ValueError('Article extraction shorter than 300 chars')
        if len(text)>200000:raise ValueError('Article extraction exceeds 200000 chars')
        digest=hashlib.sha256(text.encode()).hexdigest();result.update(textSha256=digest,characters=len(text))
        (OUT/'texts').mkdir(exist_ok=True);(OUT/'texts'/f'{digest}.txt').write_text(text,encoding='utf-8')
        if not hasattr(local,'tok'):local.tok=Tokenizer()
        candidates={}
        for paragraph in text.splitlines():
            if len(paragraph)<6:continue
            for t in local.tok.tokenize(paragraph):
                pos=t.part_of_speech.split(',');base=t.base_form if t.base_form!='*' else t.surface
                base=norm(base)
                if base in old or base in stop or len(base)<2 or re.search(r'[A-Za-z0-9０-９]',base):continue
                if pos[0] not in {'動詞','形容詞','副詞','接続詞','連体詞','名詞'}:continue
                if pos[0]=='名詞' and pos[1] not in {'一般','サ変接続','形容動詞語幹'}:continue
                if pos[0]=='動詞' and pos[1]!='自立':continue
                if t.reading=='*' or not re.search(r'[一-龯ぁ-んァ-ヶ]',base):continue
                key=(base,t.reading)
                if key not in candidates:candidates[key]={'lemma':base,'reading':hira(t.reading),'pos':','.join(pos[:2]),'surface':t.surface,'context':paragraph[:400]}
        result['candidates']=list(candidates.values())
        result['access']='full-extracted-needs-editorial-review'
    except Exception as e:
        result['access']='failed';result['error']=f'{type(e).__name__}: {e}'
    return result
items=[]
for p in sorted((ROOT/'src/content/daily').glob('*.md')):
    if not re.fullmatch(r'2026-\d\d-\d\d',p.stem) or p.stem>'2026-09-17':continue
    for i,x in enumerate(readfm(p).get('top',[]),1):items.append({'date':p.stem,'index':i,'title':x['title'],'url':x['url']})
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for r in pool.map(collect,items):
        results.append(r);print(f"{r['date']} #{r['index']}: {r.get('status','ERR')} {r.get('characters',0)} chars, {len(r.get('candidates',[]))} candidates {r.get('error','')}",flush=True)
        (OUT/'sources.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('TOTAL',len(results),'EXTRACTED',sum('textSha256' in x for x in results),flush=True)
