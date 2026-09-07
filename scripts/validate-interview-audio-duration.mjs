import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(process.cwd());
const audioRoot = join(root, 'public', 'audio', 'japanese');
const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const writeMode = args.includes('--write');
const generateAll = args.includes('--all');
const useLatest = args.includes('--latest');
const requestedDate = argValue('--date');
const fromArg = argValue('--from');

const POLICY_FROM = process.env.INTERVIEW_ACTUAL_DURATION_FROM || fromArg || '2026-09-08';
const IDEAL_MIN = Number(process.env.INTERVIEW_DURATION_IDEAL_MIN || '26');
const IDEAL_MAX = Number(process.env.INTERVIEW_DURATION_IDEAL_MAX || '34');
const HARD_MIN = Number(process.env.INTERVIEW_DURATION_HARD_MIN || '22');
const HARD_MAX = Number(process.env.INTERVIEW_DURATION_HARD_MAX || '40');
const MAX_STORED_DRIFT = Number(process.env.INTERVIEW_DURATION_MAX_STORED_DRIFT || '0.08');

const fail = (message) => {
  console.error(`\n[Interview Audio Duration] ${message}\n`);
  process.exit(1);
};

for (const [name, value] of Object.entries({ IDEAL_MIN, IDEAL_MAX, HARD_MIN, HARD_MAX, MAX_STORED_DRIFT })) {
  if (!Number.isFinite(value)) fail(`${name} 必须是数字。`);
}
if (!(HARD_MIN <= IDEAL_MIN && IDEAL_MIN <= IDEAL_MAX && IDEAL_MAX <= HARD_MAX)) {
  fail('时长阈值必须满足 HARD_MIN <= IDEAL_MIN <= IDEAL_MAX <= HARD_MAX。');
}
if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) fail('日期格式必须是 YYYY-MM-DD。');

const round3 = (value) => Math.round(value * 1000) / 1000;
const durationStatus = (duration) => {
  if (duration < HARD_MIN || duration > HARD_MAX) return 'fail';
  if (duration < IDEAL_MIN || duration > IDEAL_MAX) return 'warn';
  return 'ideal';
};

const probeDuration = (path) => {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    path,
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `ffprobe failed: ${path}`);
  const value = Number(result.stdout.trim());
  if (!Number.isFinite(value) || value <= 0) throw new Error(`无法读取有效时长: ${path}`);
  return round3(value);
};

const availableDates = () => {
  if (!existsSync(audioRoot)) return [];
  return readdirSync(audioRoot)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .filter((name) => {
      const path = join(audioRoot, name);
      return statSync(path).isDirectory() && existsSync(join(path, 'interview-manifest.json'));
    })
    .sort();
};

let dates = availableDates();
if (requestedDate) dates = dates.filter((date) => date === requestedDate);
else if (generateAll) {
  // Keep all dates so legacy manifests can be backfilled without enforcing old content.
} else if (useLatest || !fromArg) {
  dates = dates.length ? [dates.at(-1)] : [];
}
if (fromArg) dates = dates.filter((date) => date >= fromArg);

if (!dates.length) {
  console.log(`Interview audio duration: no manifests to check${fromArg ? ` (from ${fromArg})` : ''}.`);
  process.exit(0);
}
if (spawnSync('ffprobe', ['-version'], { stdio: 'ignore' }).status !== 0) {
  fail('找不到 ffprobe。安装 ffmpeg 后会同时提供 ffprobe。');
}

let failed = false;
let measured = 0;
let updated = 0;

for (const date of dates) {
  const dir = join(audioRoot, date);
  const manifestPath = join(dir, 'interview-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const enforce = date >= POLICY_FROM;
  const next = structuredClone(manifest);
  const problems = [];
  const warnings = [];

  const measureItems = (items, kind) => (Array.isArray(items) ? items : []).map((item) => {
    if (!item?.audio) return item;
    const path = join(dir, item.audio);
    if (!existsSync(path)) {
      problems.push(`${kind} ${item.index ?? '?'}: missing ${item.audio}`);
      return item;
    }

    let duration;
    try {
      duration = probeDuration(path);
    } catch (error) {
      problems.push(`${kind} ${item.index ?? '?'}: ${error instanceof Error ? error.message : String(error)}`);
      return item;
    }
    measured += 1;

    const nextItem = { ...item, durationSeconds: duration };
    if (kind === 'answer') {
      const status = durationStatus(duration);
      const expectedStatus = enforce ? status : 'legacy';
      nextItem.durationStatus = expectedStatus;
      if (enforce && status === 'fail') {
        problems.push(`answer ${item.index}: actual ${duration.toFixed(2)}s is outside hard range ${HARD_MIN}–${HARD_MAX}s`);
      } else if (enforce && status === 'warn') {
        warnings.push(`answer ${item.index}: actual ${duration.toFixed(2)}s is outside ideal range ${IDEAL_MIN}–${IDEAL_MAX}s`);
      }
      if (!writeMode && enforce && item.durationStatus !== expectedStatus) {
        problems.push(`answer ${item.index}: stored durationStatus=${item.durationStatus ?? 'missing'} but actual status=${expectedStatus}`);
      }
    }

    if (!writeMode && Number.isFinite(Number(item.durationSeconds))) {
      const drift = Math.abs(Number(item.durationSeconds) - duration);
      if (drift > MAX_STORED_DRIFT) {
        problems.push(`${kind} ${item.index ?? '?'}: stored ${Number(item.durationSeconds).toFixed(3)}s differs from ffprobe ${duration.toFixed(3)}s by ${drift.toFixed(3)}s`);
      }
    } else if (!writeMode && enforce && kind === 'answer' && !Number.isFinite(Number(item.durationSeconds))) {
      problems.push(`answer ${item.index}: manifest is missing durationSeconds; run audio duration backfill/write step`);
    }

    return nextItem;
  });

  next.interview = (Array.isArray(manifest.interview) ? manifest.interview : []).map((item) => {
    const kind = item?.type === 'answer' ? 'answer' : 'question';
    return measureItems([item], kind)[0];
  });
  next.review = measureItems(manifest.review, 'review');
  next.durationPolicy = {
    source: 'ffprobe',
    enforceFrom: POLICY_FROM,
    idealSeconds: [IDEAL_MIN, IDEAL_MAX],
    hardSeconds: [HARD_MIN, HARD_MAX],
    maxStoredDriftSeconds: MAX_STORED_DRIFT,
  };

  if (writeMode) {
    const previousComparable = structuredClone(manifest);
    const nextComparable = structuredClone(next);
    delete previousComparable.durationMeasuredAt;
    delete nextComparable.durationMeasuredAt;
    const contentChanged = JSON.stringify(previousComparable) !== JSON.stringify(nextComparable);
    if (contentChanged) {
      next.durationMeasuredAt = new Date().toISOString();
      writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
      updated += 1;
    }
  }

  console.log(`\n${date}: ${problems.length ? 'FAIL' : 'PASS'}${enforce ? '' : ' (legacy policy not enforced)'}`);
  warnings.forEach((message) => console.warn(`  WARN: ${message}`));
  problems.forEach((message) => console.error(`  ERROR: ${message}`));
  if (problems.length) failed = true;
}

console.log(`\nMeasured ${measured} MP3 file(s).${writeMode ? ` Updated ${updated} manifest(s).` : ''}`);
if (failed) process.exit(1);
console.log('Interview audio duration check passed.');
