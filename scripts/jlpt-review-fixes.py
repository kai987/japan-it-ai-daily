"""Update reviewed fixtures after a vocabulary-only migration, with A/B invariance."""
from pathlib import Path
import hashlib, subprocess

baseline = '28d10dd08b3c70cb6c4773f6b290c344114e6113'
p = Path('scripts/daily-quality-policy.mjs')
policy = p.read_text()
for language in ['daily', 'daily-ja']:
    name = f'src/content/{language}/2026-09-07.md'
    before = subprocess.check_output(['git', 'show', f'{baseline}:{name}'])
    after = Path(name).read_bytes()
    marker = b'\n# C.'
    assert marker in before and marker in after, 'Missing C boundary'
    assert before.split(marker)[0] == after.split(marker)[0], 'Reviewed A/B reference changed'
    old = hashlib.sha256(before).hexdigest()
    new = hashlib.sha256(after).hexdigest()
    assert old in policy, 'Unexpected previous reviewed reference hash'
    policy = policy.replace(old, new)
policy = policy.replace('Reviewed depth baseline;', 'Reviewed depth baseline (JLPT vocabulary-only repair; A/B byte-identical);')
p.write_text(policy)

p = Path('scripts/audio-integrity.test.mjs')
s = p.read_text()
s = s.replace("expect(report.references).toBe(60);", """const manifest = JSON.parse(readFileSync(join(root, 'public/audio/japanese/2026-09-07/manifest.json'), 'utf8'));
    const recorded = manifest.items.filter((item) => item.playback !== 'browser-tts').length;
    const fallback = manifest.items.filter((item) => item.playback === 'browser-tts').length;
    const interviews = JSON.parse(readFileSync(join(root, 'public/audio/japanese/2026-09-07/interview-manifest.json'), 'utf8'));
    expect(report.references).toBe(recorded * 2 + manifest.grammarItems.length + interviews.items.length);
    expect(report.browserFallbacks).toBe(fallback);
    expect(recorded + fallback).toBe(20);""")
s += """

describe('explicit browser fallback remains validated', () => {
  it('rejects browser fallback masquerading as a recorded asset', () => {
    const root = fixture();
    const path = join(root, 'public/audio/japanese/2026-09-07/manifest.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    const item = manifest.items.find((value) => value.playback === 'browser-tts');
    expect(item).toBeDefined();
    item.word = 'word-999.mp3';
    writeFileSync(path, JSON.stringify(manifest));
    const report = verifyAudioIntegrity({ root, ffprobeCommand: null });
    expect(report.errors.some((error) => error.includes('must not claim recorded word/example assets'))).toBe(true);
  });
});
"""
p.write_text(s)
p = Path('src/components/pages/LessonPage.astro')
s = p.read_text().replace('lesson.vocabulary.map((item, index) =>', 'lesson.vocabulary.map((item) =>').replace('lesson.grammar.map((item, index) =>', 'lesson.grammar.map((item) =>')
p.write_text(s)
print('Reviewed reference hashes refreshed only after A/B byte equality; audio fixtures now assert recordings and fallback separately.')
