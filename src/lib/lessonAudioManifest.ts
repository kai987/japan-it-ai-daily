export type LessonManifest = {
  voice?: { name?: string; style?: string };
  items?: { reading: string; term: string; word: string; exampleJa: string; example: string }[];
  grammar?: { exampleJa: string; example: string }[];
};
const normalize = (text: string = '') => String(text).normalize('NFKC').replace(/\s+/g, ' ').trim();
const safeFilename = (file: unknown): file is string => typeof file === 'string' && /^[a-zA-Z0-9_-]+\.mp3$/.test(file);
/** Never match a word only by reading (homophones), or by yesterday's array index. */
export function matchingLessonClip(manifest: LessonManifest, kind: string, text: string, term = ''): string | undefined {
  if (!manifest || typeof manifest !== 'object') return undefined;
  const target = normalize(text);
  if (!target) return undefined;
  if (kind === 'word') {
    if (!normalize(term) || !Array.isArray(manifest.items)) return undefined;
    const match = manifest.items.find((item) => item && normalize(item.term) === normalize(term) && normalize(item.reading) === target);
    return safeFilename(match?.word) ? match.word : undefined;
  }
  const items = kind === 'grammar-example' ? manifest.grammar : kind === 'example' ? manifest.items : [];
  if (!Array.isArray(items)) return undefined;
  const match = items.find((item) => item && normalize(item.exampleJa) === target);
  return safeFilename(match?.example) ? match.example : undefined;
}
