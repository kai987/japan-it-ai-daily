"""Print only concise source-anchor diagnostics; never dump full articles."""
from pathlib import Path
import concurrent.futures, json, re, unicodedata, urllib.request
from bs4 import BeautifulSoup

def norm(s):
    return re.sub(r'[\s\u200b\ufeff~～〜…]', '', unicodedata.normalize('NFKC', s))

cards = json.loads(Path('docs/grammar-history/replacement-cards.json').read_text())
def read(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (grammar-source-verification)'}), timeout=30) as r:
            raw = r.read(8000001)
            encoding = r.headers.get_content_charset() or 'utf-8'
            resolved = r.url
        soup = BeautifulSoup(raw, 'html.parser')
        title = soup.title.get_text() if soup.title else ''
        for e in soup.select('script,style,noscript'):
            e.decompose()
        return {'url':url,'resolved':resolved,'encoding':encoding,'detected':soup.original_encoding,'title':title,'text':norm(soup.get_text(' ', strip=True))}
    except Exception as e:
        return {'url':url,'error':str(e),'text':''}
urls = list(dict.fromkeys(c['source']['url'] for c in cards))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    pages = dict(zip(urls,pool.map(read,urls)))
for c in cards:
    ev=c['source']; p=pages[ev['url']]; text=p['text']; anchor=norm(ev['anchor']); surface=norm(ev['surface'])
    if anchor not in text:
        offsets=[m.start() for m in re.finditer(re.escape(surface),text)]
        print(json.dumps({'date':c['date'],'pattern':c['pattern'],'expectedAnchor':ev['anchor'],**{k:v for k,v in p.items() if k!='text'},'textLength':len(text),'surfaceContexts':[text[max(0,i-65):i+len(surface)+80] for i in offsets[:3]]},ensure_ascii=False))
print('Anchor diagnostics finished for',len(cards),'cards')
