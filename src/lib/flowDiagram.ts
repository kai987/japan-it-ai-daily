export type Layer = { title: string; detail: string };

export type FlowDiagram = {
  kind: 'flow';
  nodes: string[];
  direction: 'vertical' | 'horizontal';
};

export type LayerDiagram = {
  kind: 'layers';
  layers: Layer[];
};

export type ParsedDiagram = FlowDiagram | LayerDiagram;

const textLines = (source: unknown): string[] => String(source ?? '')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const parseLegacyFlow = (source: unknown): FlowDiagram | null => {
  const lines = textLines(source);
  if (lines.length < 3 || !lines.includes('↓')) return null;
  if (lines.some((line) => line !== '↓' && line.length > 80)) return null;

  const nodes = lines.filter((line) => line !== '↓');
  if (nodes.length < 2 || nodes.length > 12) return null;

  const arrows = lines.filter((line) => line === '↓').length;
  if (arrows !== nodes.length - 1) return null;

  return { kind: 'flow', nodes, direction: 'vertical' };
};

const parseLayerStack = (source: unknown): LayerDiagram | null => {
  const lines = textLines(source);
  if (lines.length < 4 || lines.length % 2 !== 0) return null;
  if (lines.length > 16 || lines.some((line) => line.length > 100)) return null;

  const layers: Layer[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const title = lines[index];
    const detail = lines[index + 1];
    if (!title || !detail) return null;

    const numbered = /^(?:[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|\d+[.)]?)/.test(title);
    if (!numbered || !/layer|レイヤー/i.test(title) || detail === '↓') return null;
    layers.push({ title, detail });
  }

  if (layers.length < 2 || layers.length > 8) return null;
  return { kind: 'layers', layers };
};

const cleanMermaidLabel = (value: string): string => value
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/<br\s*\/?>/gi, ' · ')
  .trim();

export const parseSimpleMermaidFlow = (source: unknown): FlowDiagram | null => {
  const lines = textLines(source).filter((line) => !line.startsWith('%%'));
  const declaration = lines.shift()?.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL)$/i);
  if (!declaration) return null;

  const definitions = new Map<string, string>();
  const paths: string[][] = [];

  for (const line of lines) {
    const definition = line.match(/^([A-Za-z][\w-]*)\s*(?:\[\s*(.*?)\s*\]|\(\s*(.*?)\s*\)|\{\s*(.*?)\s*\})$/);
    if (definition) {
      const label = definition.slice(2).find((value) => typeof value === 'string' && value.length > 0) ?? definition[1];
      definitions.set(definition[1], cleanMermaidLabel(label));
      continue;
    }

    if (line.includes('-->')) {
      const ids = line.split(/\s*-->\s*/).map((part) => part.trim()).filter(Boolean);
      if (ids.length >= 2 && ids.every((id) => /^[A-Za-z][\w-]*$/.test(id))) paths.push(ids);
    }
  }

  if (paths.length !== 1) return null;
  const ids = paths[0];
  const nodes = ids.map((id) => definitions.get(id) ?? id);
  if (nodes.length < 2 || nodes.length > 12) return null;

  const direction = /^(LR|RL)$/i.test(declaration[1]) ? 'horizontal' : 'vertical';
  return { kind: 'flow', nodes, direction };
};

export const parseLegacyText = (source: unknown): ParsedDiagram | null =>
  parseLegacyFlow(source) ?? parseLayerStack(source);
