"""Refresh reviewed fixtures after the vocabulary-only history migration."""
from pathlib import Path
import hashlib
import json
import subprocess

baseline = '28d10dd08b3c70cb6c4773f6b290c344114e6113'

# The 9/7 quality exception protects the reviewed A/B article text. The JLPT repair
# intentionally changes only section C, so prove A/B byte equality before refreshing
# the two full-file hashes used by the existing gate.
policy_path = Path('docs/daily-quality-policy.json')
policy = json.loads(policy_path.read_text())
for language in ['daily', 'daily-ja']:
    name = f'src/content/{language}/2026-09-07.md'
    before = subprocess.check_output(['git', 'show', f'{baseline}:{name}'])
    after = Path(name).read_bytes()
    marker = b'\n# C.'
    assert marker in before and marker in after, 'Missing C boundary'
    assert before.split(marker)[0] == after.split(marker)[0], 'Reviewed A/B reference changed'
    old = hashlib.sha256(before).hexdigest()
    new = hashlib.sha256(after).hexdigest()
    assert policy['files'].get(name) == old, f'Unexpected previous reviewed reference hash for {name}'
    policy['files'][name] = new
policy_path.write_text(json.dumps(policy, ensure_ascii=False, indent=2) + '\n')

# The repaired vocabulary deliberately converts some historical vocabulary recordings
# to explicit browser TTS. Make the fixture assert the exact manifest-driven recording
# count rather than the old hard-coded 60 assets.
test_path = Path('scripts/audio-integrity.test.mjs')
s = test_path.read_text()
needle = "    expect(collectAudioAssets(root).assets.size).toBe(60);"
replacement = """    const learning = JSON.parse(readFileSync(`${audio}/manifest.json`, 'utf8'));
    const interview = JSON.parse(readFileSync(`${audio}/interview-manifest.json`, 'utf8'));
    const expectedAssets = (interview.interview?.length ?? 0) + (interview.review?.length ?? 0)
      + learning.items.filter((item) => item.playback !== 'browser-tts').length * 2
      + learning.grammar.length;
    expect(collectAudioAssets(root).assets.size).toBe(expectedAssets);"""
assert needle in s, 'Expected historical audio fixture assertion not found'
test_path.write_text(s.replace(needle, replacement))

print('Reviewed A/B hashes refreshed after byte-equality proof; audio fixture now follows the manifest.')
