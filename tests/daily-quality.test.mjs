import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('daily quality limitation recognition', () => {
  it('accepts self-report versus delivery-data separation as a concrete validation condition', () => {
    const result = spawnSync(process.execPath, ['scripts/validate-daily-quality.mjs', '--date=2026-09-24'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});
