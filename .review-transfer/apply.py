from pathlib import Path
import hashlib
before={'package.json':'50fc7c5cf67fc308b80668e1810b87b2e888714ae6e30ce346d2f005822cdf75','src/components/pages/LearningPage.astro':'f8ca02817e20a0bae0d0909acda22271d7453c7d526c84067baddcae83714869','src/components/pages/LessonPage.astro':'2574ddf08b53fe91c6d755023992df1227a6c7b82daef81c74f18ec2611f4317','src/components/pages/ReportPage.astro':'2c11a902ea17ce8969fcf7c017089e00f81d7cecad4d9185d57fc7c139cbbf6c','src/content/daily/2026-09-18.md':'3633d7eebbc83356ff8d6b220577c5b6121309a47d96eff7f2fc4ae2c72c7066','src/content/daily-ja/2026-09-18.md':'df1a3f3eb7228f39671f835af815712cf577acd93b6c1260e6e2d0c44bfa7a00'}
after={'package.json':'accb6f36e72c3c0416c6d5ae6d5c3b59551442f2ccf2297f57af45b1f1f39ed8','src/components/pages/LearningPage.astro':'59b26933cb86c1b9f893d69a104087daf041beb914b703a161e712c30997a9d7','src/components/pages/LessonPage.astro':'23e3a9c9b09a99fe607e38c5860ce436ec3d98b3ca40b09d861c4c52854d5b41','src/components/pages/ReportPage.astro':'c3d4b3ab36a4360c3731b5be529e8a4c3569ec17ce30233aa1a11c2e6d4f3b56','src/content/daily/2026-09-18.md':'be90ff13befbcd44002534d80d2ab85ad67768caedeb31bfe57a56b4b31bb4e1','src/content/daily-ja/2026-09-18.md':'b673b39db0fb6cc75e7c8c5f627dd06dfdbc9a402eb45d246947166dcfc477e8'}
files={name:Path(name).read_text() for name in before}
for name,text in files.items():
 assert hashlib.sha256(text.encode()).hexdigest()==before[name],f'Concurrent change: {name}'
def change(name,old,new):
 assert files[name].count(old)==1,(name,old)
 files[name]=files[name].replace(old,new)
p='package.json'
change(p,'npm run jlpt:check && npm run grammar:check"','npm run jlpt:check && npm run grammar:check && npm run study:check"')
change(p,'"grammar:check": "node scripts/check-grammar-history.mjs"','"grammar:check": "node scripts/check-grammar-history.mjs",\n    "study:check": "node scripts/check-study-review.mjs"')
p='src/components/pages/LearningPage.astro'
change(p,"import BaseLayout from '../../layouts/BaseLayout.astro';","import BaseLayout from '../../layouts/BaseLayout.astro';\nimport { getStudyDay } from '../../../scripts/learning-review.mjs';")
change(p,"          const lessonLevels = ['N5/N4', ...lesson.data.levels];","          const study = getStudyDay(lesson.id, locale);\n          const lessonLevels = ['N5/N4', ...new Set([...lesson.data.levels, ...study.reviewVocabulary.map((x:any)=>x.level), ...study.reviewGrammar.map((x:any)=>x.level)])];")
change(p,'{lesson.data.vocabularyCount}','{study.studyVocabularyCount}')
change(p,'{lesson.data.grammarCount}','{study.studyGrammarCount}')
p='src/components/pages/LessonPage.astro'
change(p,"import LessonAudio from '../LessonAudio.astro';","import LessonAudio from '../LessonAudio.astro';\nimport StudyBadge from '../StudyBadge.astro';")
change(p,'.map((level) => ({ level, items: data.vocabulary.map((item, index) => ({ item, index })).filter(({ item }) => item.level === level) }))','.map((level) => ({ level, items: data.vocabulary.map((item: any, index: number) => ({ item, index })).filter(({ item }: any) => item.level === level) }))')
change(p,'  .filter((group) => group.items.length > 0);\n---',"""  .filter((group) => group.items.length > 0);
if (data.reviewVocabulary.length) vocabGroups.push({ level: '本文で復習できる既習語彙', items: data.reviewVocabulary.map((item: any, index: number) => ({item,index})) });
const grammarGroups = [
  { title: locale === 'ja' ? '新規文法' : '新学语法', kind: 'new', items: data.grammar },
  { title: '本文で復習できる既習文法', kind: 'review', items: data.reviewGrammar },
].filter(group => group.items.length);

---""")
change(p,'      <p class="meta">{data.description}</p>',"""      <p class="meta">{data.description}</p>
      <p class="meta" data-study-counts>{locale === 'ja' ? `語彙 ${data.vocabulary.length} 新規＋${data.reviewVocabulary.length} 復習＝${data.studyVocabularyCount}語 ／ 文法 ${data.grammar.length} 新規＋${data.reviewGrammar.length} 復習＝${data.studyGrammarCount}項目` : `词汇 ${data.vocabulary.length} 新学＋${data.reviewVocabulary.length} 复习＝${data.studyVocabularyCount}词 ／ 语法 ${data.grammar.length} 新学＋${data.reviewGrammar.length} 复习＝${data.studyGrammarCount}项`}</p>""")
change(p,'{group.items.map(({ item, index }) => (','{group.items.map(({ item }: { item: any }) => (')
change(p,'<article class="study-card vocabulary-card">','<article class="study-card vocabulary-card" data-study-kind={item.studyKind}>')
change(p,'                        <span class="level-badge">参考：{item.level}</span>\n                      </header>',"""                        <StudyBadge item={item} locale={locale} />
                      </header>
                      {item.studyKind === 'review' && <div class="nuance-note" data-review-evidence><strong>本文で復習</strong><p lang="ja">{item.reviewEvidence.excerpt}</p><a href={`${root}japanese/${item.firstIntroducedDate}/`}>{locale === 'ja' ? '初出' : '首次学习'}：{item.firstIntroducedDate}</a></div>}""")
change(p,'{item.collocations.map((phrase) =>','{item.collocations.map((phrase: string) =>')
change(p,'            ))}\n          </section>','            ))}\n            {data.reviewVocabularyNote && <p class="meta">{data.reviewVocabularyNote}</p>}\n          </section>')
change(p,'{data.technicalTerms.map((item) =>','{data.technicalTerms.map((item: any) =>')
change(p,'            <div class="grammar-card-grid">\n              {data.grammar.map((item, index) => (\n                <article class="study-card grammar-card">',"""            {grammarGroups.map(group => (
            <section class="study-level-group" data-grammar-group={group.kind}>
            <h3>{group.title}（{group.items.length}）</h3>
            <div class="grammar-card-grid">
              {group.items.map((item: any) => (
                <article class="study-card grammar-card" data-study-kind={item.studyKind}>""")
change(p,'                    <span class="level-badge">参考：{item.level}</span>\n                  </header>',"""                    <StudyBadge item={item} locale={locale} />
                  </header>
                  {item.studyKind === 'review' && <div class="nuance-note" data-review-evidence><strong>本文で復習</strong><p lang="ja">{item.reviewEvidence.excerpt}</p><a href={`${root}japanese/${item.firstIntroducedDate}/`}>{locale === 'ja' ? '初出' : '首次学习'}：{item.firstIntroducedDate}</a></div>}""")
change(p,'            </div>\n          </section>','            </div>\n            </section>\n            ))}\n            {data.reviewGrammarNote && <p class="meta">{data.reviewGrammarNote}</p>}\n          </section>')
change(p,'{data.mustRememberWords.map((item) =>','{data.mustRememberWords.map((item: string) =>')
change(p,'{data.mustRememberGrammar.map((item) =>','{data.mustRememberGrammar.map((item: string) =>')
p='src/components/pages/ReportPage.astro'
change(p,"import LegacyReportEnhancements from '../LegacyReportEnhancements.astro';","import LegacyReportEnhancements from '../LegacyReportEnhancements.astro';\nimport { titleWithIssue, getStudyDay } from '../../../scripts/learning-review.mjs';\nimport ReportStudySupplement from '../ReportStudySupplement.astro';")
change(p,'const { Content, headings } = await render(report);','const numberedTitle = titleWithIssue(report.data.title, report.id);\nconst study = getStudyDay(report.id, locale);\nconst { Content, headings } = await render(report);')
change(p,'title={`${report.data.title} · Japan IT / AI Daily`}','title={`${numberedTitle} · Japan IT / AI Daily`}')
change(p,'<h1>{report.data.title}</h1>','<h1>{numberedTitle}</h1>')
change(p,'      <p class="meta">{report.data.description}</p>',"""      <p class="meta">{report.data.description}</p>
      <p class="meta" data-study-counts>{locale === "ja" ? `学習：語彙 ${study.vocabulary.length} 新規＋${study.reviewVocabulary.length} 復習 ／ 文法 ${study.grammar.length} 新規＋${study.reviewGrammar.length} 復習` : `学习：词汇 ${study.vocabulary.length} 新学＋${study.reviewVocabulary.length} 复习 ／ 语法 ${study.grammar.length} 新学＋${study.reviewGrammar.length} 复习`}</p>""")
change(p,'      <Content />','      <Content />\n      <ReportStudySupplement study={study} locale={locale} />')
p='src/content/daily/2026-09-18.md'
change(p,'因此本日不使用旧语法凑数。结构化数据记录 `grammarCount: 0`。','因此结构化新语法仍记录 `grammarCount: 0`。另以「本文で復習できる既習文法」单独补充7项复习文型，网页合计显示7项；复习不冒充新学。')
p='src/content/daily-ja/2026-09-18.md'
change(p,'そのため既出項目で補充せず、`grammarCount: 0` とする。','新規文型は `grammarCount: 0` のまま、「本文で復習できる既習文法」を別枠で7項目追加し、学習対象は合計7項目とする。復習を新規文型として数えない。')
for name,text in files.items():
 actual=hashlib.sha256(text.encode()).hexdigest()
 assert actual==after[name],(name,actual,after[name])
for name,text in files.items(): Path(name).write_text(text)
print('Applied six source changes; all preimage and postimage SHA-256 checks passed.')
