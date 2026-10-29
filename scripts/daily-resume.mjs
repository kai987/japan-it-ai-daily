import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validDate, requiredFiles, requiredSidecars, planPublication, releaseVerified, tokyoClock } from './daily-publication.mjs';
import { leaseActive, leaseBlobSha, validateLease } from './publication-lease.mjs';
import { versionedAudioKey } from '../src/lib/audioVersion.mjs';
import { ghJson, readRemoteLease, mutateRemoteLease, REPOSITORY } from './local-publication-lease.mjs';

export const AUDIO_FROM = '2026-09-30';
export const STAGES = ['pending', 'generated', 'validated', 'pushed', 'r2_verified', 'pages_verified', 'playback_verified'];
const HASH = /^[a-f0-9]{64}$/, COMMIT = /^[a-f0-9]{40}$/;
const ACTIVE = new Set(['queued', 'pending', 'requested', 'waiting', 'in_progress']);
const DEFAULTS = Object.freeze({ engineUrl: 'http://127.0.0.1:10101', speaker: 'morioki', style: 'ノーマル', styleId: 497929760, wordSpeed: 1, exampleSpeed: 1, interviewSpeed: 1 });
const PAGES_AUDIO_URL = 'https://kai987.github.io/japan-it-ai-daily/audio/';
export const sourcePaths = date => requiredFiles(date).concat(requiredSidecars(date));
export const manifestPaths = date => ['manifest.json', 'interview-manifest.json'].map(name => `public/audio/japanese/${validDate(date)}/${name}`);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const hashPaths = (root, paths) => Object.fromEntries(paths.map(path => [path, digest(readFileSync(join(root, path)))]));
const same = (a, b) => Object.keys(a || {}).length === Object.keys(b || {}).length && Object.entries(a || {}).every(([k, v]) => b?.[k] === v);
const json = path => JSON.parse(readFileSync(path, 'utf8'));

export function validateSettings(settings) {
  if (!settings || ['engineUrl', 'speaker', 'style', 'styleId'].some(key => settings[key] !== DEFAULTS[key]) ||
      ['wordSpeed', 'exampleSpeed', 'interviewSpeed'].some(key => !Number.isFinite(settings[key]) || settings[key] <= 0 || settings[key] > 2)) throw new Error('Invalid frozen local audio settings');
  return settings;
}
export function freezeSettings(root, date, previous) {
  const settings = { ...DEFAULTS };
  const manifests = manifestPaths(date).map(path => existsSync(join(root, path)) ? json(join(root, path)) : null);
  for (const [index, manifest] of manifests.entries()) {
    if (!manifest) continue;
    if (manifest.date !== date || manifest.engineUrl !== DEFAULTS.engineUrl || manifest.voice?.name !== DEFAULTS.speaker || manifest.voice?.style !== DEFAULTS.style || manifest.voice?.styleId !== DEFAULTS.styleId) throw new Error('Existing manifest voice/date must be verified before recovery');
    const values = index === 0 ? { wordSpeed: manifest.settings?.wordSpeed, exampleSpeed: manifest.settings?.exampleSpeed } : { interviewSpeed: manifest.settings?.speed };
    Object.assign(settings, values);
    if (previous && Object.keys(values).some(key => previous.settings?.[key] !== values[key])) throw new Error('Checkpoint and committed manifest settings differ; inspect before recovery');
  }
  return validateSettings(previous ? previous.settings : settings);
}
export function validateAudioCheckpoint(state, date = state?.targetDate) {
  validDate(date);
  if (!state || state.schemaVersion !== 1 || state.targetDate !== date || !STAGES.includes(state.stage) || !COMMIT.test(state.textSourceCommit || '')) throw new Error('Malformed audio checkpoint');
  validateSettings(state.settings);
  if (!same(Object.fromEntries(sourcePaths(date).map(path => [path, state.sourceHashes?.[path]])), state.sourceHashes) || Object.values(state.sourceHashes).some(hash => !HASH.test(hash || ''))) throw new Error('Six frozen source hashes required');
  for (const stamp of [state.createdAt, state.updatedAt]) if (typeof stamp !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(stamp) || !Number.isFinite(Date.parse(stamp))) throw new Error('Invalid checkpoint timestamp');
  if (Date.parse(state.updatedAt) < Date.parse(state.createdAt)) throw new Error('Checkpoint clock moved backwards');
  if (STAGES.indexOf(state.stage) >= STAGES.indexOf('validated') &&
      (!same(Object.fromEntries(manifestPaths(date).map(path => [path, state.manifestHashes?.[path]])), state.manifestHashes) || Object.values(state.manifestHashes).some(hash => !HASH.test(hash || '')))) throw new Error('Validated audio requires both frozen manifest hashes');
  if (STAGES.indexOf(state.stage) >= STAGES.indexOf('pushed') && !COMMIT.test(state.audioCommit || '')) throw new Error('Pushed audio requires exact audioCommit');
  return state;
}
export function writeAudioCheckpoint(stateDir, state, previousBytes) {
  validateAudioCheckpoint(state);
  mkdirSync(stateDir, { recursive: true });
  const file = join(stateDir, `${state.targetDate}.json`), lock = `${file}.lock`, temporary = `${file}.${randomUUID()}.tmp`;
  let fd, locked = false;
  try {
    fd = openSync(lock, 'wx', 0o600); locked = true; closeSync(fd); fd = undefined;
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current !== previousBytes) throw new Error('Audio checkpoint changed concurrently; refresh before writing');
    if (current) {
      const previous = validateAudioCheckpoint(JSON.parse(current), state.targetDate);
      if (!same(previous.sourceHashes, state.sourceHashes) || !same(previous.settings, state.settings) || previous.textSourceCommit !== state.textSourceCommit || previous.createdAt !== state.createdAt) throw new Error('Frozen audio inputs cannot be overwritten');
      if (Date.parse(state.updatedAt) < Date.parse(previous.updatedAt)) throw new Error('Checkpoint clock moved backwards');
      if (STAGES.indexOf(state.stage) < STAGES.indexOf(previous.stage)) throw new Error('Audio stage cannot move backwards');
      if (STAGES.indexOf(previous.stage) >= 2 && !same(previous.manifestHashes, state.manifestHashes)) throw new Error('Validated manifest hashes cannot be overwritten');
      if (STAGES.indexOf(previous.stage) >= 3 && previous.audioCommit !== state.audioCommit) throw new Error('Published audio commit cannot be overwritten without reviewed recovery');
    }
    const bytes = `${JSON.stringify(state, null, 2)}\n`;
    fd = openSync(temporary, 'wx', 0o600); writeFileSync(fd, bytes); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(temporary, file);
    if (readFileSync(file, 'utf8') !== bytes) throw new Error('Audio checkpoint read-back mismatch');
    return bytes;
  } finally { if (fd !== undefined) closeSync(fd); rmSync(temporary, { force: true }); if (locked) rmSync(lock); }
}
export function readAudioCheckpoints(stateDir) {
  if (!existsSync(stateDir)) return {};
  return Object.fromEntries(readdirSync(stateDir).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().map(name => {
    const date = name.slice(0, 10);
    try { return [date, json(join(stateDir, name))]; } catch { return [date, { inspectionError: 'Malformed audio checkpoint JSON' }]; }
  }));
}
export function coordinationBlock(observation) {
  if (!Object.hasOwn(observation, 'lease') || !Array.isArray(observation.activeRuns)) return 'complete_coordination_required';
  if (leaseActive(observation.lease, observation.now)) return 'active_author_lease';
  if (observation.activeRuns.some(run => ACTIVE.has(run.status))) return 'writer_or_deployment_in_progress';
  return null;
}
export function audioNextStep(state, root, date) {
  if (!state) return { action: 'initialize_audio', targetDate: date, reason: 'missing_checkpoint_is_not_completion' };
  validateAudioCheckpoint(state, date);
  if (!same(state.sourceHashes, hashPaths(root, sourcePaths(date)))) return { action: 'inspect', targetDate: date, reason: 'frozen_source_changed' };
  freezeSettings(root, date, state);
  if (STAGES.indexOf(state.stage) >= 2 && !same(state.manifestHashes, hashPaths(root, manifestPaths(date)))) return { action: 'inspect', targetDate: date, reason: 'frozen_manifest_changed' };
  if (state.error) return { action: 'inspect_failure', targetDate: date, stage: state.stage, error: state.error, nextStep: state.nextStep };
  if (STAGES.indexOf(state.stage) >= 2) {
    try { verifiedDateRecordings(root, date); } catch { return { action: 'inspect', targetDate: date, reason: 'recording_bytes_changed_or_missing' }; }
  }
  const proof = name => [state[`${name}Verification`], state.verificationEvidence?.[name]].find(evidence => evidence?.commit === state.audioCommit);
  if (STAGES.indexOf(state.stage) >= 4 && !manifestEvidencePresent(proof('r2'), state, 'r2', verifiedDateRecordings(root, date).recordings.size)) return { action: 'inspect', targetDate: date, reason: 'r2_evidence_incomplete' };
  const release = state.pagesReleaseVerification || state.verificationEvidence?.audioRelease;
  if (STAGES.indexOf(state.stage) >= 5 && (!manifestEvidencePresent(proof('pages'), state, 'pages', verifiedDateRecordings(root, date).recordings.size) || (release?.releaseCommit || release?.sourceCommit) !== state.audioCommit || release.fullSnapshotCompared !== true)) return { action: 'inspect', targetDate: date, reason: 'pages_evidence_incomplete' };
  if (state.stage === 'playback_verified' && !completionEvidencePresent(state, root)) return { action: 'inspect', targetDate: date, reason: 'completion_evidence_incomplete' };
  return { action: ({ pending: 'generate_audio', generated: 'validate_audio', validated: 'commit_audio', pushed: 'verify_r2', r2_verified: 'verify_pages', pages_verified: 'verify_playback', playback_verified: 'idle' })[state.stage], targetDate: date, stage: state.stage };
}
export function verifiedDateRecordings(root, date) {
  const [learning, interview] = manifestPaths(date).map(path => json(join(root, path)));
  const recordings = new Set();
  const roles = Object.fromEntries(['daily', 'word', 'example', 'grammar', 'review'].map(role => [role, new Set()]));
  const check = (filename, hash, sourceDate = date) => {
    validDate(sourceDate);
    if (sourceDate > date || !/^[\w-]+\.mp3$/.test(filename || '') || !HASH.test(hash || '')) throw new Error('Invalid frozen recording reference');
    const key = `japanese/${sourceDate}/${filename}`, bytes = readFileSync(join(root, 'public/audio', key));
    if (!bytes.length || digest(bytes) !== hash) throw new Error('Recording byte hash mismatch');
    const versioned = versionedAudioKey(key, hash); recordings.add(versioned); return versioned;
  };
  for (const item of learning.items || []) if (item.playback !== 'browser-tts') {
    const word = check(item.word, item.wordSha256, item.audioDate || date), example = check(item.example, item.exampleSha256, item.audioDate || date);
    roles.word.add(word); roles.example.add(example); if (item.studyKind === 'review') { roles.review.add(word); roles.review.add(example); }
  }
  for (const item of learning.grammar || []) if (item.playback !== 'browser-tts') { const key = check(item.example, item.exampleSha256, item.audioDate || date); roles.grammar.add(key); if (item.studyKind === 'review') roles.review.add(key); }
  for (const item of [...(interview.interview || []), ...(interview.review || [])]) { const key = check(item.audio, item.audioSha256); if (item.type === 'answer') roles.daily.add(key); }
  if (!recordings.size) throw new Error('No validated recording references');
  return { recordings, learning, roles };
}
export function manifestEvidencePresent(proof, state, kind, count) {
  if (!proof || proof.commit !== state.audioCommit || !Number.isSafeInteger(proof.workflowRunId) || proof.workflowRunId <= 0 || !Number.isSafeInteger(proof.referencedRecordings) || proof.referencedRecordings <= 0 || (count !== undefined && proof.referencedRecordings !== count)) return false;
  if (proof.workflowScope && (!Number.isSafeInteger(proof.workflowScope.count) || proof.workflowScope.count < proof.referencedRecordings || proof.workflowScope.targetReferencedCount !== proof.referencedRecordings)) return false;
  let base;
  try { base = new URL(kind === 'pages' ? PAGES_AUDIO_URL : `${proof.baseUrl.replace(/\/$/, '')}/`); if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || (kind === 'r2' && base.pathname !== '/')) return false; } catch { return false; }
  return manifestPaths(state.targetDate).every(path => proof.manifestChecks?.some(check => check.sha256 === state.manifestHashes[path] && check.bytes > 0 && check.url === new URL(path.slice('public/audio/'.length), base).href));
}
export function completionEvidencePresent(state, root) {
  const r2 = [state.r2Verification, state.verificationEvidence?.r2].find(proof => proof?.commit === state.audioCommit);
  const pages = [state.pagesVerification, state.verificationEvidence?.pages].find(proof => proof?.commit === state.audioCommit);
  const release = state.pagesReleaseVerification || state.verificationEvidence?.audioRelease;
  const playback = state.playbackVerification?.tests || state.verificationEvidence?.playback;
  let base;
  try { base = new URL(r2?.baseUrl); if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') return false; } catch { return false; }
  let inventory;
  if (root) { try { inventory = verifiedDateRecordings(root, state.targetDate); } catch { return false; } }
  const recordingPlayed = (test, role) => {
    try {
      const url = new URL(test.url);
      return url.origin === base.origin && /^\/japanese\/\d{4}-\d{2}-\d{2}\/[\w-]+--[a-f0-9]{64}\.mp3$/.test(url.pathname) &&
        !url.search && !url.hash && (!inventory || (role ? inventory.roles[role] : inventory.recordings).has(url.pathname.slice(1))) && test.error === null && test.paused === false &&
        Number.isFinite(test.duration) && test.duration > 0 && test.currentTime > 0 && test.endTime > test.currentTime;
    } catch { return false; }
  };
  const played = (locale, kind, role, selector) => playback?.some(test => test.locale === locale && test.kind === kind && (!selector || selector.test(test.selector || '')) && recordingPlayed(test, role));
  const remote = state.verificationEvidence?.remoteAudio;
  return Boolean(manifestEvidencePresent(r2, state, 'r2', inventory?.recordings.size) && manifestEvidencePresent(pages, state, 'pages', inventory?.recordings.size) &&
    (!remote || (remote.hashAlgorithm === 'SHA-256' && remote.count >= r2.referencedRecordings)) &&
    (release?.releaseCommit || release?.sourceCommit) === state.audioCommit && release.fullSnapshotCompared === true &&
    Array.isArray(playback) && ['zh', 'ja'].every(locale => played(locale, 'daily', 'daily') && played(locale, 'japanese', 'word', /speech-kind=["']?word/) && played(locale, 'japanese', 'example', /speech-kind=["']?example/) &&
      (!inventory?.roles.grammar.size || played(locale, 'japanese', 'grammar', /speech-kind=["']?grammar-example/)) &&
      (!inventory?.roles.review.size || played(locale, 'japanese', 'review', /study-kind=["']?review/))));
}
export function planDailyResume(observation, states, root) {
  const text = planPublication(observation), audio = [];
  const today = tokyoClock(observation.now).date;
  const dates = [...new Set((observation.inventory?.files || []).flatMap(path => path.match(/^src\/content\/daily\/(\d{4}-\d{2}-\d{2})\.md$/)?.[1] || []))].filter(date => date >= AUDIO_FROM && date <= today).sort();
  const block = coordinationBlock(observation);
  for (const date of dates) {
    if (!sourcePaths(date).every(path => observation.inventory.files.includes(path)) || !releaseVerified(observation.release, observation.inventory.sourceCommit, date)) {
      audio.push({ targetDate: date, action: 'wait', reason: 'verified_text_publication_required' }); continue;
    }
    const mainHashes = observation.inventory.sourceHashesByDate?.[date];
    let localMatches = false;
    try { localMatches = Boolean(mainHashes && same(mainHashes, hashPaths(root, sourcePaths(date)))); } catch { /* Preserve the independent text plan. */ }
    if (!localMatches) {
      audio.push({ targetDate: date, action: 'inspect', reason: 'exact_main_source_hashes_required' }); continue;
    }
    let next;
    try { next = audioNextStep(states[date], root, date); } catch (error) { next = { targetDate: date, action: 'inspect', reason: 'audio_checkpoint_or_inputs_invalid', message: error.message }; }
    audio.push(next.action !== 'idle' && block ? { targetDate: date, action: 'wait', reason: block, resumeAction: next.action } : next);
  }
  return { text, audio, nextAudio: audio.find(item => item.action !== 'idle') || null };
}
export function readLiveCoordination({ api = ghJson, now = () => new Date().toISOString() } = {}) {
  const observed = readRemoteLease(api);
  // Verify SHA/schema through the existing helper, without claiming or renewing.
  if (!observed.complete || leaseBlobSha(observed.content) !== observed.sha) throw new Error('Incomplete lease observation or blob SHA mismatch');
  const lease = validateLease(JSON.parse(observed.content));
  const activeRuns = [];
  for (const workflow of ['publish-daily.yml', 'deploy.yml', 'sync-r2-audio.yml']) {
    for (const status of ACTIVE) {
      const response = api(['api', `repos/${REPOSITORY}/actions/workflows/${workflow}/runs?status=${status}&per_page=100`]);
      if (!Array.isArray(response.workflow_runs) || !Number.isInteger(response.total_count) || response.total_count > response.workflow_runs.length) throw new Error('Incomplete active workflow inventory');
      activeRuns.push(...response.workflow_runs.filter(run => workflow === 'publish-daily.yml' || run.head_branch === 'main'));
    }
  }
  return { now: now(), lease, activeRuns };
}
export async function ensureAudioEngine(settings, { fetchImpl = fetch, run = execFileSync, sleep = ms => new Promise(done => setTimeout(done, ms)), now = Date.now } = {}) {
  validateSettings(settings);
  const ready = async () => { try { return (await fetchImpl(`${settings.engineUrl}/version`, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; } };
  if (!await ready()) {
    run('open', ['-a', 'AivisSpeech'], { timeout: 10_000 });
    const deadline = now() + 120_000;
    while (now() < deadline && !await ready()) await sleep(3000);
  }
  if (!await ready()) throw new Error('AivisSpeech did not become ready within 120 seconds');
  const response = await fetchImpl(`${settings.engineUrl}/speakers`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Unable to verify AivisSpeech voice');
  const speakers = await response.json();
  if (!Array.isArray(speakers) || !speakers.some(speaker => speaker.name === settings.speaker && speaker.styles?.some(style => style.name === settings.style && style.id === settings.styleId))) throw new Error('Required morioki / ノーマル voice unavailable');
}
export async function runLocalAudio({ root, stateDir, date, observation }, { run = execFileSync, coordination = readLiveCoordination, engine = ensureAudioEngine, now = () => new Date().toISOString() } = {}) {
  validDate(date);
  if (date < AUDIO_FROM || date > tokyoClock(now()).date) throw new Error('Audio recovery date outside authorized cutover window');
  const real = path => {
    let current = resolve(path), tail = [];
    while (!existsSync(current)) { tail.unshift(current.slice(dirname(current).length + 1)); current = dirname(current); }
    return resolve(realpathSync(current), ...tail);
  };
  const inRepo = relative(real(root), real(stateDir));
  if (inRepo !== '..' && !inRepo.startsWith('../') && !inRepo.startsWith('/')) throw new Error('Audio progress must stay outside the repository');
  const file = join(stateDir, `${date}.json`);
  let bytes = existsSync(file) ? readFileSync(file, 'utf8') : null;
  let state = bytes ? validateAudioCheckpoint(JSON.parse(bytes), date) : null;
  const plan = planDailyResume({ ...observation, now: now() }, state ? { [date]: state } : {}, root).audio.find(item => item.targetDate === date);
  if (!plan || plan.action === 'wait' || plan.action === 'inspect') throw new Error(`Audio is not ready for local work: ${plan?.reason || 'missing_date'}`);
  if (state?.error) throw new Error('Read and resolve the recorded failure before resuming local generation');
  const guard = () => {
    const block = coordinationBlock(coordination());
    if (block) throw new Error(`Yield local audio: ${block}`);
    const paths = sourcePaths(date), frozen = state?.sourceHashes || hashPaths(root, paths);
    if (!same(frozen, hashPaths(root, paths))) throw new Error('Frozen source changed during local audio work');
    // Bind to the actual remote main source, without updating the user's files.
    run('git', ['fetch', 'origin', 'main'], { cwd: root, timeout: 60_000 });
    for (const path of paths) if (digest(run('git', ['show', `origin/main:${path}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 })) !== frozen[path]) throw new Error('Latest main text differs from frozen audio input');
    return frozen;
  };
  const sourceHashes = guard();
  if (state && STAGES.indexOf(state.stage) >= 2) return { ...plan, synthesisSkipped: true };
  if (!state) {
    state = { schemaVersion: 1, targetDate: date, textSourceCommit: observation.inventory.sourceCommit, sourceHashes,
      settings: freezeSettings(root, date), createdAt: now(), updatedAt: now(), stage: 'pending', audioCommit: null, workflowRunIds: {}, manifestHashes: {}, verificationEvidence: { text: observation.release }, error: null, nextStep: 'Generate and validate local audio' };
    bytes = writeAudioCheckpoint(stateDir, state, bytes);
  }
  const save = patch => { state = { ...state, ...patch, updatedAt: now() }; bytes = writeAudioCheckpoint(stateDir, state, bytes); };
  let phase = 'engine';
  try {
    if (state.stage === 'pending') { guard(); await engine(state.settings); }
    const env = { ...process.env, AIVIS_ENGINE_URL: state.settings.engineUrl, AIVIS_STYLE_ID: String(state.settings.styleId), AIVIS_WORD_SPEED: String(state.settings.wordSpeed), AIVIS_EXAMPLE_SPEED: String(state.settings.exampleSpeed), AIVIS_INTERVIEW_SPEED: String(state.settings.interviewSpeed) };
    const commands = [ ...(state.stage === 'pending' ? [['learning', 'node', ['scripts/generate-japanese-audio.mjs', '--date', date]], ['interview', 'node', ['scripts/generate-interview-audio.mjs', '--date', date]]] : []),
      ['duration-write', 'node', ['scripts/validate-interview-audio-duration.mjs', '--date', date, '--write']], ...['audio:check', 'audio:integrity:check', 'audio:versions:check', 'audio:duration:check'].map(name => [name, 'npm', ['run', name]]) ];
    for (const [name, command, args] of commands) {
      phase = name; guard();
      const output = run(command, args, { cwd: root, env, encoding: 'utf8', timeout: 20 * 60_000, maxBuffer: 16 * 1024 * 1024 });
      const log = join(stateDir, 'logs', date, `${name.replaceAll(':', '-')}.log`); mkdirSync(dirname(log), { recursive: true }); writeFileSync(log, output || '', { mode: 0o600 });
      if (name === 'interview') save({ stage: 'generated', nextStep: 'Validate existing recordings; no resynthesis needed' });
    }
    guard();
    save({ stage: 'validated', manifestHashes: hashPaths(root, manifestPaths(date)), localChecksCompletedAt: now(), nextStep: 'Review audio-only diff, coordinate push, then verify exact R2, Pages and playback' });
    return { action: 'commit_audio', targetDate: date, stage: state.stage };
  } catch (error) {
    const log = join(stateDir, 'logs', date, `${phase.replaceAll(':', '-')}-failed.log`); mkdirSync(dirname(log), { recursive: true }); writeFileSync(log, `${error.stdout || ''}\n${error.stderr || error.message}`, { mode: 0o600 });
    save({ error: { stage: phase, message: error.message, log, at: now() }, nextStep: 'Read the precise failure log and refresh coordination; preserve frozen settings and existing recordings' });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, ...args] = process.argv.slice(2), options = {};
    const allowed = command === 'lease' ? ['--date', '--operation', '--owner', '--lease-id', '--reason']
      : command === 'audio-local' ? ['--date', '--observation', '--state-dir', '--root']
      : command === 'plan' ? ['--observation', '--state-dir', '--root'] : [];
    if (!allowed.length) throw new Error('Expected plan, audio-local or an explicit lease operation');
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i];
      if (!allowed.includes(key) || options[key] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Invalid/duplicate recovery option');
      options[key] = args[i + 1];
    }
    const root = resolve(options['--root'] || process.cwd()), stateDir = resolve(options['--state-dir'] || join(homedir(), '.codex/automations/it-ai-codex/audio-progress'));
    let result;
    if (command === 'lease') {
      const operation = options['--operation'];
      result = mutateRemoteLease({ operation, targetDate: validDate(options['--date']), ...(operation === 'claim' ? { owner: options['--owner'] } : { leaseId: options['--lease-id'] }), ...(operation === 'release' ? { reason: options['--reason'] } : {}) });
    } else {
      if (!['plan', 'audio-local'].includes(command) || !options['--observation']) throw new Error('Usage: npm run daily:resume -- <plan|audio-local> --observation /outside-repo/observation.json [--date YYYY-MM-DD]');
      const input = json(resolve(options['--observation']));
      execFileSync('git', ['fetch', 'origin', 'main'], { cwd: root, timeout: 60_000, stdio: 'pipe' });
      const sourceCommit = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
      if (input.inventory?.sourceCommit !== sourceCommit) throw new Error('Observation is stale; refresh exact-main release/checkpoints before resuming');
      const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim().split('\n');
      const sourceHashesByDate = {};
      for (const path of files) {
        const date = path.match(/^src\/content\/daily\/(\d{4}-\d{2}-\d{2})\.md$/)?.[1];
        if (date && date >= AUDIO_FROM && sourcePaths(date).every(source => files.includes(source))) {
          sourceHashesByDate[date] = Object.fromEntries(sourcePaths(date).map(source => [source, digest(execFileSync('git', ['show', `${sourceCommit}:${source}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 }))]));
        }
      }
      const observation = { ...input, inventory: { complete: true, sourceCommit, files, sourceHashesByDate }, now: new Date().toISOString(), mode: 'daily', ...readLiveCoordination() };
      result = command === 'plan' ? planDailyResume(observation, readAudioCheckpoints(stateDir), root) : await runLocalAudio({ root, stateDir, date: options['--date'], observation });
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
