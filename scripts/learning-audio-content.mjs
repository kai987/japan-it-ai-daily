import { parse } from 'yaml';

export function learningAudioCards(source, label = 'learning content') {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) throw new Error(`${label}: missing frontmatter`);
  const data = parse(frontmatter);
  if (!data || typeof data !== 'object' || !Array.isArray(data.vocabulary) || !Array.isArray(data.grammar)) {
    throw new Error(`${label}: vocabulary and grammar must be arrays`);
  }

  const vocabulary = data.vocabulary.map((item, index) => {
    if (typeof item?.term !== 'string' || !item.term.trim()
      || typeof item?.reading !== 'string' || !item.reading.trim()
      || typeof item?.exampleJa !== 'string' || !item.exampleJa.trim()) {
      throw new Error(`${label}: incomplete vocabulary card ${index + 1}`);
    }
    return { term: item.term, reading: item.reading, exampleJa: item.exampleJa };
  });
  const grammar = data.grammar.map((item, index) => {
    if (typeof item?.pattern !== 'string' || !item.pattern.trim()
      || typeof item?.exampleJa !== 'string' || !item.exampleJa.trim()) {
      throw new Error(`${label}: incomplete grammar card ${index + 1}`);
    }
    return { pattern: item.pattern, exampleJa: item.exampleJa };
  });
  return { vocabulary, grammar };
}
