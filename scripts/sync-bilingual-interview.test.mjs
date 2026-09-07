import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, expect } from 'vitest';

const script = resolve('scripts/sync-bilingual-interview.mjs');
const report = (questions, answers, policy = true) => `---\n${policy ? 'interviewSource: originals\n' : ''}---\n\n## 3. 面接で使えるポイント\n\n` + questions.map((q, i) => `### 話題${i + 1}\n\n**質問：**\n\n> ${q}\n\n**30秒回答：**\n\n> ${answers[i]}\n\n`).join('') + '## 4. 次の節\n';
const questions = ['運用は？', '検索は？', '学習は？', '遷移は？', '端末は？'];
const answers = ['結果を読み戻します。', 'パスを絞ります。', 'データを用意します。', '表示を調べます。', 'メモリーを測ります。'];

function fixture(body, check) {
  const root = mkdtempSync(join(tmpdir(), 'interview-policy-'));
  const zh = join(root, 'src/content/daily');
  const ja = join(root, 'src/content/daily-ja');
  mkdirSync(zh, { recursive: true }); mkdirSync(ja, { recursive: true });
  const path = join(ja, '2026-08-12.md');
  writeFileSync(path, body);
  // Reading this as a Chinese source file would fail, proving the marked path
  // takes precedence before Chinese body access.
  mkdirSync(join(zh, '2026-08-12.md'));
  try { check(root, path); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('check and write modes preserve original-article answers without Chinese body access', () => {
  const body = report(questions, answers);
  fixture(body, (cwd, path) => {
    for (const args of [[], ['--check']]) {
      const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(path, 'utf8')).toBe(body);
      expect(result.stdout).toContain('Validated 1 original-article');
    }
  });
});

test.each([
  [questions.slice(0, 4), answers.slice(0, 4), 'five complete'],
  [[questions[0], questions[0], ...questions.slice(2)], answers, 'duplicate interview question'],
  [questions, answers.map((a) => a + '段階的に導入します。'), 'repeated interview closing'],
])('rejects incomplete or repetitive reviewed answers', (qs, as, error) => {
  fixture(report(qs, as), (cwd) => {
    const result = spawnSync(process.execPath, [script, '--check'], { cwd, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(error);
  });
});

test('legacy shared pairs still require equality', () => {
  fixture(report(questions, answers, false), (cwd) => {
    const path = join(cwd, 'src/content/daily/2026-08-12.md');
    rmSync(path, { recursive: true });
    writeFileSync(path, report(questions, answers.map((a) => a + '別の文です。'), false));
    const check = spawnSync(process.execPath, [script, '--check'], { cwd, encoding: 'utf8' });
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain('mismatch');
  });
});
