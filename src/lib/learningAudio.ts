/** Never infer a vocabulary recording from its current display index. */
export type LearningManifest = {
  voice?: { name?: string; style?: string };
  items?: { term: string; reading: string; exampleJa: string; word?: string | null; example?: string | null; playback?: string; studyKind?: 'new' | 'review'; identity?: string; firstIntroducedDate?: string; audioDate?: string }[];
  grammar?: { pattern?: string; exampleJa: string; example?: string | null; playback?: string; studyKind?: 'new' | 'review'; identity?: string; firstIntroducedDate?: string; audioDate?: string }[];
};
export type SpeechTarget = { kind: string; term?: string; reading?: string; text: string };
export type LearningRecordingAsset = { file: string; audioDate?: string };

const normalize = (text: unknown) => typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
const safeFile = (value: unknown): string | null => typeof value === 'string' && /^[\w-]+\.mp3$/.test(value) ? value : null;
const safeDate = (value: unknown): string | null => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

const recordingAsset = (item: { audioDate?: string }, fileValue: unknown): LearningRecordingAsset | null => {
  const file = safeFile(fileValue);
  if (!file) return null;
  if (item.audioDate === undefined) return { file };
  const audioDate = safeDate(item.audioDate);
  return audioDate ? { file, audioDate } : null;
};

export function resolveLearningRecordingAsset(manifest: LearningManifest, target: SpeechTarget): LearningRecordingAsset | null {
  if (target.kind === 'grammar-example') {
    const matches = (manifest.grammar || []).filter((item) => normalize(item.exampleJa) === normalize(target.text));
    return matches.length === 1 && matches[0].playback !== 'browser-tts'
      ? recordingAsset(matches[0], matches[0].example)
      : null;
  }
  if (!target.term || !target.reading || !['word', 'example'].includes(target.kind)) return null;
  const matches = (manifest.items || []).filter((item) =>
    normalize(item.term) === normalize(target.term) && normalize(item.reading) === normalize(target.reading));
  if (matches.length !== 1) return null;
  const item = matches[0];
  if (item.playback === 'browser-tts') return null;
  if (target.kind === 'example' && normalize(item.exampleJa) !== normalize(target.text)) return null;
  if (target.kind === 'word' && normalize(target.text) !== normalize(target.reading) && normalize(target.text) !== normalize(target.term)) return null;
  return recordingAsset(item, target.kind === 'word' ? item.word : item.example);
}

export function resolveLearningRecording(manifest: LearningManifest, target: SpeechTarget): string | null {
  return resolveLearningRecordingAsset(manifest, target)?.file ?? null;
}
