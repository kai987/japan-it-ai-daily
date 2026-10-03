import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { claimLease, leaseBlobSha } from './publication-lease.mjs';
import { sourcePaths, manifestPaths, hashPaths, freezeSettings, validateAudioCheckpoint, writeAudioCheckpoint,
  readAudioCheckpoints, coordinationBlock, audioNextStep, completionEvidencePresent, planDailyResume,
  readLiveCoordination, runLocalAudio } from './daily-resume.mjs';

const DATE = '2026-09-30', NOW = '2026-09-30T11:00:00+09:00', SHA = 'a'.repeat(40);
const settings = { engineUrl: 'http://127.0.0.1:10101', speaker: 'morioki', style: 'ノーマル', styleId: 497929760, wordSpeed: 1, exampleSpeed: 1, interviewSpeed: 0.86 };
const roots = [];
const release = { id: 17, branch: 'main', path: '.github/workflows/deploy.yml', headSha: SHA, status: 'completed', conclusion: 'success',
  build: 'success', deploy: 'success', publicationVerification: 'success', snapshotSourceCommit: SHA, snapshotDates: [DATE], grammarLessonDates: [DATE] };
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'daily-resume-test-')); roots.push(directory);
  const root = join(directory, 'repo'), stateDir = join(directory, 'progress');
  const write = (path, bytes) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), bytes); };
  for (const path of sourcePaths(DATE)) write(path, `frozen ${path}\n`);
  const recording = (name, sourceDate = DATE) => {
    const bytes = Buffer.from(`trusted recording fixture ${sourceDate}/${name}`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    write(`public/audio/japanese/${sourceDate}/${name}`, bytes);
    return { name, sha256, url: `https://audio.example/japanese/${sourceDate}/${name.slice(0, -4)}--${sha256}.mp3` };
  };
  const recordings = { word: recording('word.mp3'), example: recording('example.mp3'), grammar: recording('grammar.mp3'),
    reviewWord: recording('review-word.mp3', '2026-09-29'), reviewExample: recording('review-example.mp3', '2026-09-29'), interview: recording('interview.mp3') };
  const common = { date: DATE, engineUrl: settings.engineUrl, voice: { name: settings.speaker, style: settings.style, styleId: settings.styleId } };
  write(manifestPaths(DATE)[0], JSON.stringify({ ...common, settings: { wordSpeed: settings.wordSpeed, exampleSpeed: settings.exampleSpeed },
    items: [{ word: recordings.word.name, wordSha256: recordings.word.sha256, example: recordings.example.name, exampleSha256: recordings.example.sha256 },
      { studyKind: 'review', audioDate: '2026-09-29', word: recordings.reviewWord.name, wordSha256: recordings.reviewWord.sha256, example: recordings.reviewExample.name, exampleSha256: recordings.reviewExample.sha256 }],
    grammar: [{ example: recordings.grammar.name, exampleSha256: recordings.grammar.sha256 }] }));
  write(manifestPaths(DATE)[1], JSON.stringify({ ...common, settings: { speed: settings.interviewSpeed }, interview: [{ type: 'answer', audio: recordings.interview.name, audioSha256: recordings.interview.sha256 }], review: [] }));
  const observation = { now: NOW, mode: 'daily', from: DATE, inventory: { complete: true, sourceCommit: SHA, files: sourcePaths(DATE), sourceHashesByDate: { [DATE]: hashPaths(root, sourcePaths(DATE)) } },
    lease: null, activeRuns: [], release, latestRun: release };
  const checkpoint = (patch = {}) => ({ schemaVersion: 1, targetDate: DATE, textSourceCommit: SHA, sourceHashes: hashPaths(root, sourcePaths(DATE)),
    settings: { ...settings }, createdAt: NOW, updatedAt: NOW, stage: 'pending', audioCommit: null, workflowRunIds: {},
    manifestHashes: {}, verificationEvidence: { text: release }, error: null, nextStep: 'Generate local recordings', ...patch });
  return { root, stateDir, write, observation, checkpoint, recordings };
};
const completed = (f) => {
  const state = f.checkpoint({ stage: 'playback_verified', audioCommit: 'b'.repeat(40), manifestHashes: hashPaths(f.root, manifestPaths(DATE)) });
  const manifests = manifestPaths(DATE).map(path => ({ url: `https://audio.example/japanese/${DATE}/${path.split('/').at(-1)}`, sha256: state.manifestHashes[path], bytes: readFileSync(join(f.root, path)).length }));
  state.r2Verification = { commit: state.audioCommit, workflowRunId: 20, referencedRecordings: 6, manifestChecks: manifests, baseUrl: 'https://audio.example' };
  state.pagesVerification = { commit: state.audioCommit, workflowRunId: 21, referencedRecordings: 6,
    manifestChecks: manifests.map(check => ({ ...check, url: check.url.replace('https://audio.example/', 'https://kai987.github.io/japan-it-ai-daily/audio/') })) };
  state.pagesReleaseVerification = { releaseCommit: state.audioCommit, fullSnapshotCompared: true };
  state.playbackVerification = { tests: ['zh', 'ja'].flatMap(locale => [
    { kind: 'daily', selector: '[data-report-speech-kind="interview"]', recording: 'interview' },
    { kind: 'japanese', selector: '[data-speech-kind="word"]', recording: 'word' },
    { kind: 'japanese', selector: '[data-speech-kind="example"]', recording: 'example' },
    { kind: 'japanese', selector: '[data-speech-kind="grammar-example"]', recording: 'grammar' },
    { kind: 'japanese', selector: '[data-study-kind="review"] [data-speech-kind="example"]', recording: 'reviewExample' },
  ].map(({ kind, selector, recording }) => ({ locale, kind, selector, error: null, paused: false, duration: 30, currentTime: 0.2, endTime: 1, url: f.recordings[recording].url }))) };
  return state;
};
afterEach(() => { vi.unstubAllEnvs(); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });

describe('frozen audio recovery', () => {
  it('preserves manifest settings including 0.86 and rejects a different date, voice or checkpoint speed', () => {
    const f = fixture();
    expect(freezeSettings(f.root, DATE)).toEqual(settings);
    expect(freezeSettings(f.root, DATE, f.checkpoint())).toEqual(settings);
    expect(() => freezeSettings(f.root, DATE, f.checkpoint({ settings: { ...settings, interviewSpeed: 1 } }))).toThrow(/settings differ/);
    const path = manifestPaths(DATE)[1];
    const manifest = JSON.parse(readFileSync(join(f.root, path), 'utf8'));
    for (const patch of [{ date: '2026-10-01' }, { voice: { ...manifest.voice, styleId: 1 } }]) {
      f.write(path, JSON.stringify({ ...manifest, ...patch }));
      expect(() => freezeSettings(f.root, DATE)).toThrow(/voice\/date/);
    }
  });

  it('resumes audio even when text is idle; missing state cannot mean completion', () => {
    const f = fixture();
    const missing = planDailyResume(f.observation, {}, f.root);
    expect(missing.text.action).toBe('idle');
    expect(missing.nextAudio).toMatchObject({ targetDate: DATE, action: 'initialize_audio', reason: 'missing_checkpoint_is_not_completion' });
    expect(planDailyResume(f.observation, { [DATE]: f.checkpoint({ stage: 'generated' }) }, f.root).nextAudio.action).toBe('validate_audio');
    expect(readAudioCheckpoints(f.stateDir)).toEqual({});
  });

  it('detects source and validated-manifest hash drift before advancing', () => {
    const f = fixture(), state = f.checkpoint({ stage: 'validated', manifestHashes: hashPaths(f.root, manifestPaths(DATE)) });
    expect(audioNextStep(state, f.root, DATE).action).toBe('commit_audio');
    const source = sourcePaths(DATE)[0], original = readFileSync(join(f.root, source));
    f.write(source, 'changed original text');
    expect(audioNextStep(state, f.root, DATE)).toMatchObject({ action: 'inspect', reason: 'frozen_source_changed' });
    f.write(source, original);
    f.write(manifestPaths(DATE)[0], `${readFileSync(join(f.root, manifestPaths(DATE)[0]), 'utf8')}\n`);
    expect(audioNextStep(state, f.root, DATE)).toMatchObject({ action: 'inspect', reason: 'frozen_manifest_changed' });
  });

  it('requires complete verified text and yields to an author or each active workflow state', () => {
    const f = fixture();
    expect(planDailyResume({ ...f.observation, release: { ...release, publicationVerification: 'failure' } }, {}, f.root).nextAudio.reason).toBe('verified_text_publication_required');
    expect(planDailyResume({ ...f.observation, inventory: { ...f.observation.inventory, files: sourcePaths(DATE).slice(0, 5) } }, {}, f.root).nextAudio.reason).toBe('verified_text_publication_required');
    const lease = claimLease(null, { owner: 'other author', targetDate: DATE, now: NOW });
    expect(planDailyResume({ ...f.observation, lease }, {}, f.root).nextAudio).toMatchObject({ action: 'wait', reason: 'active_author_lease', resumeAction: 'initialize_audio' });
    for (const status of ['queued', 'pending', 'requested', 'waiting', 'in_progress']) {
      expect(planDailyResume({ ...f.observation, activeRuns: [{ status }] }, {}, f.root).nextAudio.reason).toBe('writer_or_deployment_in_progress');
    }
    expect(coordinationBlock({ now: NOW, activeRuns: [] })).toBe('complete_coordination_required');
  });

  it('requires exact main hashes rather than assuming the local working files match a release', () => {
    const f = fixture();
    for (const sourceHashesByDate of [{}, { [DATE]: { ...hashPaths(f.root, sourcePaths(DATE)), [sourcePaths(DATE)[0]]: 'f'.repeat(64) } }]) {
      expect(planDailyResume({ ...f.observation, inventory: { ...f.observation.inventory, sourceHashesByDate } }, {}, f.root).nextAudio).toMatchObject({ action: 'inspect', reason: 'exact_main_source_hashes_required' });
    }
    rmSync(join(f.root, sourcePaths(DATE)[0]));
    const plan = planDailyResume(f.observation, {}, f.root);
    expect(plan.text.action).toBe('idle');
    expect(plan.nextAudio).toMatchObject({ action: 'inspect', reason: 'exact_main_source_hashes_required' });
  });

  it('retains the independent text plan when an audio checkpoint or its manifests are corrupt', () => {
    const f = fixture(); mkdirSync(f.stateDir, { recursive: true }); writeFileSync(join(f.stateDir, `${DATE}.json`), '{');
    expect(planDailyResume(f.observation, readAudioCheckpoints(f.stateDir), f.root)).toMatchObject({ text: { action: 'idle' }, nextAudio: { action: 'inspect' } });
    const state = f.checkpoint({ stage: 'validated', manifestHashes: hashPaths(f.root, manifestPaths(DATE)) });
    rmSync(join(f.root, manifestPaths(DATE)[0]));
    expect(planDailyResume(f.observation, { [DATE]: state }, f.root)).toMatchObject({ text: { action: 'idle' }, nextAudio: { action: 'inspect', reason: 'audio_checkpoint_or_inputs_invalid' } });
  });

  it('does not skip recording-byte verification just because the source and manifests are unchanged', () => {
    const f = fixture(), state = f.checkpoint({ stage: 'validated', manifestHashes: hashPaths(f.root, manifestPaths(DATE)) });
    f.write(`public/audio/japanese/${DATE}/word.mp3`, 'different cached recording bytes');
    expect(audioNextStep(state, f.root, DATE)).toMatchObject({ action: 'inspect', reason: 'recording_bytes_changed_or_missing' });
  });

  it('rejects checkpoint storage inside Git including dot-dot-prefixed directories and outside symlinks', async () => {
    const f = fixture(), run = vi.fn(), engine = vi.fn(), inner = join(f.root, 'private-progress');
    mkdirSync(inner, { recursive: true });
    const symlink = join(dirname(f.root), 'progress-link'); symlinkSync(inner, symlink, 'dir');
    for (const stateDir of [inner, join(f.root, '..audio-progress'), symlink]) {
      await expect(runLocalAudio({ root: f.root, stateDir, date: DATE, observation: f.observation }, { run, engine, now: () => NOW })).rejects.toThrow(/outside the repository/);
    }
    expect(run).not.toHaveBeenCalled(); expect(engine).not.toHaveBeenCalled();
  });

  it('keeps the frozen date and explicit 0.86 speed across midnight despite ambient overrides', async () => {
    const f = fixture(), calls = [];
    vi.stubEnv('AIVIS_INTERVIEW_SPEED', '1.5');
    const run = (command, args, options) => {
      calls.push({ command, args, options });
      if (command === 'git') return args[0] === 'show' ? readFileSync(join(f.root, args[1].slice('origin/main:'.length))) : Buffer.alloc(0);
      throw new Error('stop at first synthesis command');
    };
    const afterMidnight = '2026-10-01T00:15:00+09:00';
    await expect(runLocalAudio({ root: f.root, stateDir: f.stateDir, date: DATE, observation: f.observation }, {
      run, coordination: () => ({ now: afterMidnight, lease: null, activeRuns: [] }), engine: async () => {}, now: () => afterMidnight,
    })).rejects.toThrow(/first synthesis command/);
    const synthesis = calls.find(call => call.command === 'node');
    expect(synthesis.args).toEqual(['scripts/generate-japanese-audio.mjs', '--date', DATE]);
    expect(synthesis.options.env.AIVIS_INTERVIEW_SPEED).toBe('0.86');
    const saved = readAudioCheckpoints(f.stateDir)[DATE];
    expect(saved.targetDate).toBe(DATE);
    expect(saved.settings.interviewSpeed).toBe(0.86);
    expect(saved.error.stage).toBe('learning');
    expect(calls.filter(call => call.command === 'node')).toHaveLength(1);
  });

  it('refuses local generation when latest main differs or a writer starts after planning', async () => {
    for (const hazard of ['main-drift', 'active-writer']) {
      const f = fixture(), calls = [], engine = vi.fn();
      await expect(runLocalAudio({ root: f.root, stateDir: f.stateDir, date: DATE, observation: f.observation }, {
        run: (command, args) => { calls.push(command); return args[0] === 'show' ? Buffer.from('different main source') : Buffer.alloc(0); },
        coordination: () => ({ now: NOW, lease: null, activeRuns: hazard === 'active-writer' ? [{ status: 'in_progress' }] : [] }),
        engine, now: () => NOW,
      })).rejects.toThrow(hazard === 'main-drift' ? /Latest main text differs/ : /Yield local audio/);
      expect(engine).not.toHaveBeenCalled();
      expect(calls).not.toContain('node');
      expect(existsSync(join(f.stateDir, `${DATE}.json`))).toBe(false);
    }
  });

  it('skips synthesis for validated audio but rejects unresolved failure checkpoints', async () => {
    const f = fixture(), engine = vi.fn();
    const run = vi.fn((command, args) => args[0] === 'show' ? readFileSync(join(f.root, args[1].slice('origin/main:'.length))) : Buffer.alloc(0));
    const dependencies = { run, engine, coordination: () => ({ now: NOW, lease: null, activeRuns: [] }), now: () => NOW };
    const state = f.checkpoint({ stage: 'validated', manifestHashes: hashPaths(f.root, manifestPaths(DATE)) });
    let bytes = writeAudioCheckpoint(f.stateDir, state, null);
    expect(await runLocalAudio({ root: f.root, stateDir: f.stateDir, date: DATE, observation: f.observation }, dependencies)).toMatchObject({ action: 'commit_audio', synthesisSkipped: true });
    expect(run.mock.calls.some(([command, args]) => command === 'git' && args[0] === 'fetch')).toBe(true);
    const guardedCalls = run.mock.calls.length;
    bytes = writeAudioCheckpoint(f.stateDir, { ...state, error: { stage: 'validation', message: 'unresolved failure' } }, bytes);
    await expect(runLocalAudio({ root: f.root, stateDir: f.stateDir, date: DATE, observation: f.observation }, dependencies)).rejects.toThrow(/failure|not ready/);
    expect(run.mock.calls.length).toBe(guardedCalls);
    expect(run.mock.calls.every(([command]) => command === 'git')).toBe(true);
    expect(engine).not.toHaveBeenCalled();
  });
});

describe('durable checkpoint writes', () => {
  it('writes private JSON atomically, reads it back and leaves no lock or temporary files', () => {
    const f = fixture(), state = f.checkpoint();
    const bytes = writeAudioCheckpoint(f.stateDir, state, null);
    expect(readFileSync(join(f.stateDir, `${DATE}.json`), 'utf8')).toBe(bytes);
    expect(readAudioCheckpoints(f.stateDir)[DATE]).toEqual(state);
    expect(statSync(join(f.stateDir, `${DATE}.json`)).mode & 0o777).toBe(0o600);
    expect(readdirSync(f.stateDir)).toEqual([`${DATE}.json`]);
  });

  it('rejects stale CAS and an existing writer lock without replacing bytes or deleting the other lock', () => {
    const f = fixture(), state = f.checkpoint(), bytes = writeAudioCheckpoint(f.stateDir, state, null);
    expect(() => writeAudioCheckpoint(f.stateDir, { ...state, stage: 'generated' }, null)).toThrow(/concurrently/);
    expect(readFileSync(join(f.stateDir, `${DATE}.json`), 'utf8')).toBe(bytes);
    const lock = join(f.stateDir, `${DATE}.json.lock`); writeFileSync(lock, 'other writer');
    expect(() => writeAudioCheckpoint(f.stateDir, { ...state, stage: 'generated' }, bytes)).toThrow(/EEXIST/);
    expect(readFileSync(lock, 'utf8')).toBe('other writer');
    expect(readFileSync(join(f.stateDir, `${DATE}.json`), 'utf8')).toBe(bytes);
  });

  it('allows exactly one concurrent process to advance the same checkpoint', async () => {
    const f = fixture(), state = f.checkpoint(), bytes = writeAudioCheckpoint(f.stateDir, state, null);
    const script = `import {writeAudioCheckpoint} from ${JSON.stringify(new URL('./daily-resume.mjs', import.meta.url).href)}; writeAudioCheckpoint(process.argv[1], JSON.parse(process.argv[2]), process.argv[3]);`;
    const launch = () => promisify(execFile)(process.execPath, ['--input-type=module', '-e', script, f.stateDir, JSON.stringify({ ...state, stage: 'generated' }), bytes]);
    const results = await Promise.allSettled([launch(), launch()]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(readAudioCheckpoints(f.stateDir)[DATE].stage).toBe('generated');
    expect(readdirSync(f.stateDir)).toEqual([`${DATE}.json`]);
  });

  it('preserves frozen inputs, monotonic stage and prior checkpoint time', () => {
    const f = fixture(), state = f.checkpoint({ stage: 'generated', updatedAt: '2026-09-30T11:10:00+09:00' });
    const bytes = writeAudioCheckpoint(f.stateDir, state, null);
    for (const patch of [{ textSourceCommit: 'd'.repeat(40) }, { settings: { ...settings, interviewSpeed: 1 } },
      { sourceHashes: { ...state.sourceHashes, [sourcePaths(DATE)[0]]: 'e'.repeat(64) } },
      { createdAt: '2026-09-30T11:01:00+09:00' }, { stage: 'pending' }, { updatedAt: '2026-09-30T11:09:00+09:00' }]) {
      expect(() => writeAudioCheckpoint(f.stateDir, { ...state, ...patch }, bytes)).toThrow(/Frozen|backwards/);
      expect(readFileSync(join(f.stateDir, `${DATE}.json`), 'utf8')).toBe(bytes);
      expect(readdirSync(f.stateDir)).toEqual([`${DATE}.json`]);
    }
  });

  it('rejects malformed frozen hashes and incomplete validated or pushed checkpoints', () => {
    const f = fixture(), state = f.checkpoint();
    for (const patch of [{ targetDate: '2026-10-01' }, { sourceHashes: {} }, { sourceHashes: { ...state.sourceHashes, extra: 'a'.repeat(64) } },
      { stage: 'validated' }, { stage: 'pushed', manifestHashes: hashPaths(f.root, manifestPaths(DATE)) },
      { updatedAt: '2026-09-30T10:59:00+09:00' }]) expect(() => validateAudioCheckpoint({ ...state, ...patch }, DATE)).toThrow();
  });

  it('cannot replace frozen validated manifests or the exact published audio commit', () => {
    const f = fixture(), state = f.checkpoint({ stage: 'pushed', audioCommit: 'b'.repeat(40), manifestHashes: hashPaths(f.root, manifestPaths(DATE)) });
    const bytes = writeAudioCheckpoint(f.stateDir, state, null);
    for (const patch of [{ manifestHashes: { ...state.manifestHashes, [manifestPaths(DATE)[0]]: 'd'.repeat(64) } }, { audioCommit: 'e'.repeat(40) }]) {
      expect(() => writeAudioCheckpoint(f.stateDir, { ...state, ...patch }, bytes)).toThrow(/Frozen|manifest|commit/);
      expect(readFileSync(join(f.stateDir, `${DATE}.json`), 'utf8')).toBe(bytes);
    }
  });
});

describe('publication and playback completion evidence', () => {
  it('accepts complete matching evidence and legacy outside-Git field aliases', () => {
    const f = fixture(), state = completed(f);
    expect(completionEvidencePresent(state, f.root)).toBe(true);
    expect(audioNextStep(state, f.root, DATE).action).toBe('idle');
    const legacy = structuredClone(state);
    legacy.verificationEvidence.r2 = legacy.r2Verification; delete legacy.r2Verification;
    legacy.verificationEvidence.audioRelease = { sourceCommit: legacy.audioCommit, fullSnapshotCompared: true }; delete legacy.pagesReleaseVerification;
    legacy.verificationEvidence.playback = legacy.playbackVerification.tests; delete legacy.playbackVerification;
    expect(completionEvidencePresent(legacy, f.root)).toBe(true);
  });

  it('never treats a stage label as completion without real publication and advancing recorded playback proof', () => {
    const f = fixture(), state = completed(f);
    const variants = [
      { ...state, r2Verification: undefined }, { ...state, pagesVerification: undefined }, { ...state, pagesReleaseVerification: undefined },
      { ...state, r2Verification: { ...state.r2Verification, commit: SHA } },
      { ...state, r2Verification: { ...state.r2Verification, manifestChecks: [] } },
      { ...state, pagesVerification: { ...state.pagesVerification, workflowRunId: 0 } },
      { ...state, r2Verification: { ...state.r2Verification, referencedRecordings: 0 } },
      { ...state, r2Verification: { ...state.r2Verification, referencedRecordings: 5 } },
      { ...state, r2Verification: { ...state.r2Verification, workflowScope: { count: 5, targetReferencedCount: 6 } } },
      { ...state, r2Verification: { ...state.r2Verification, workflowScope: { count: 6, targetReferencedCount: 0 } } },
      { ...state, r2Verification: { ...state.r2Verification, manifestChecks: state.r2Verification.manifestChecks.map(check => ({ ...check, bytes: 0 })) } },
      { ...state, pagesVerification: { ...state.pagesVerification, manifestChecks: state.r2Verification.manifestChecks } },
      { ...state, verificationEvidence: { ...state.verificationEvidence, remoteAudio: { hashAlgorithm: 'SHA-1', count: 6 } } },
      { ...state, verificationEvidence: { ...state.verificationEvidence, remoteAudio: { hashAlgorithm: 'SHA-256', count: 0 } } },
      { ...state, pagesReleaseVerification: { ...state.pagesReleaseVerification, fullSnapshotCompared: false } },
      { ...state, playbackVerification: { tests: state.playbackVerification.tests.slice(0, 3) } },
      { ...state, playbackVerification: { tests: state.playbackVerification.tests.filter(test => !test.selector.includes('grammar-example')) } },
      { ...state, playbackVerification: { tests: state.playbackVerification.tests.filter(test => !test.selector.includes('study-kind')) } },
      { ...state, playbackVerification: { tests: state.playbackVerification.tests.map(test => ({ ...test, url: f.recordings.word.url })) } },
    ];
    for (const patch of [{ error: 'decode failed' }, { paused: true }, { duration: Infinity }, { endTime: 0.2 }, { url: 'speechSynthesis' },
      { url: f.recordings.word.url.replace('audio.example', 'unrelated.example') },
      { url: `https://audio.example/japanese/${DATE}/unrelated--${'c'.repeat(64)}.mp3` }]) {
      variants.push({ ...state, playbackVerification: { tests: state.playbackVerification.tests.map(test => ({ ...test, ...patch })) } });
    }
    for (const invalid of variants) {
      expect(completionEvidencePresent(invalid, f.root)).toBe(false);
      const next = audioNextStep(invalid, f.root, DATE);
      expect(next.action).toBe('inspect');
      expect(next.reason).toMatch(/^(r2|pages|completion)_evidence_incomplete$/);
    }
  });
});

describe('live coordination observation', () => {
  const remote = (lease) => {
    const content = JSON.stringify(lease);
    return { type: 'file', encoding: 'base64', content: Buffer.from(content).toString('base64'), sha: leaseBlobSha(content) };
  };
  const expired = () => claimLease(null, { owner: 'finished writer', targetDate: DATE, now: '2026-09-30T10:00:00+09:00' });
  it('verifies lease bytes/schema and examines every active status across publisher, Pages and R2', () => {
    const calls = [];
    const api = args => {
      calls.push(args);
      if (args[1].includes('/contents/')) return remote(expired());
      if (args[1].includes('publish-daily.yml') && args[1].includes('status=queued')) return { total_count: 2, workflow_runs: [{ id: 1, status: 'queued', head_branch: 'automation/daily-publish-request' }, { id: 2, status: 'queued', head_branch: 'main' }] };
      if (args[1].includes('sync-r2-audio.yml') && args[1].includes('status=waiting')) return { total_count: 1, workflow_runs: [{ id: 3, status: 'waiting', head_branch: 'main' }] };
      return { total_count: 0, workflow_runs: [] };
    };
    const observation = readLiveCoordination({ api, now: () => NOW });
    expect(observation.activeRuns.map(run => run.id)).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(16);
    expect(calls.every(args => !args.includes('PUT'))).toBe(true);
    expect(coordinationBlock(observation)).toBe('writer_or_deployment_in_progress');
  });
  it('rejects forged SHA, null lease and truncated workflow results instead of interpreting them as idle', () => {
    for (const response of [{ ...remote(expired()), sha: 'f'.repeat(40) }, remote(null)]) {
      expect(() => readLiveCoordination({ api: () => response, now: () => NOW })).toThrow();
    }
    expect(() => readLiveCoordination({ api: args => args[1].includes('/contents/') ? remote(expired()) : { total_count: 101, workflow_runs: [] }, now: () => NOW })).toThrow(/Incomplete active workflow/);
    let calls = 0;
    expect(() => readLiveCoordination({ api: () => { calls++; throw new Error('HTTP 403'); }, now: () => NOW })).toThrow(/403/);
    expect(calls).toBe(1);
  });
});
