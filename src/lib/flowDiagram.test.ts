import { describe, expect, it } from 'vitest';
import { parseLegacyText, parseSimpleMermaidFlow } from './flowDiagram';

describe('native flow diagram parser', () => {
  it('parses the 2026-08-31 Sandbox containment flow', () => {
    const source = `
Agent
 ↓
Container / Sandbox
 ↓
只允许一部分 Tool
`;

    expect(parseLegacyText(source)).toEqual({
      kind: 'flow',
      direction: 'vertical',
      nodes: ['Agent', 'Container / Sandbox', '只允许一部分 Tool'],
    });
  });

  it('parses the 2026-08-31 five-layer containment stack', () => {
    const source = `
① Capability Boundary
Tool / API / File / Network Permission

② Workload Isolation
VM / Container / Network Segmentation

③ Communication Control
Agent-Agent / Shared Storage / Side Channel

④ Continuous Monitoring
Tool Trace / Network / CoT / Anomaly

⑤ Automatic Containment
Kill Switch / Credential Revoke / Session Stop
`;

    expect(parseLegacyText(source)).toEqual({
      kind: 'layers',
      layers: [
        { title: '① Capability Boundary', detail: 'Tool / API / File / Network Permission' },
        { title: '② Workload Isolation', detail: 'VM / Container / Network Segmentation' },
        { title: '③ Communication Control', detail: 'Agent-Agent / Shared Storage / Side Channel' },
        { title: '④ Continuous Monitoring', detail: 'Tool Trace / Network / CoT / Anomaly' },
        { title: '⑤ Automatic Containment', detail: 'Kill Switch / Credential Revoke / Session Stop' },
      ],
    });
  });

  it('parses both 2026-08-28 Human and Agent runtime flows', () => {
    const human = `
Human
  ↓
Browser UI
  ↓
HTML / CSS / Form
  ↓
Session / Cookie
  ↓
Backend API
`;

    const agent = `
Agent Identity
      ↓
Capability Discovery
      ↓
Structured Content / MCP / API
      ↓
Lightweight Isolated Runtime
      ↓
Tool Execution
      ↓
Audit / Policy
`;

    expect(parseLegacyText(human)).toEqual({
      kind: 'flow',
      direction: 'vertical',
      nodes: ['Human', 'Browser UI', 'HTML / CSS / Form', 'Session / Cookie', 'Backend API'],
    });

    expect(parseLegacyText(agent)).toEqual({
      kind: 'flow',
      direction: 'vertical',
      nodes: [
        'Agent Identity',
        'Capability Discovery',
        'Structured Content / MCP / API',
        'Lightweight Isolated Runtime',
        'Tool Execution',
        'Audit / Policy',
      ],
    });
  });

  it('parses the 2026-08-28 four-layer Agent platform stack', () => {
    const source = `
① Context Layer
Markdown / Structured Data / RAG

② Capability Layer
API / MCP / Skills

③ Runtime Layer
Isolation / Browser / Filesystem

④ Governance Layer
Identity / Permission / Cost / Audit
`;

    expect(parseLegacyText(source)).toEqual({
      kind: 'layers',
      layers: [
        { title: '① Context Layer', detail: 'Markdown / Structured Data / RAG' },
        { title: '② Capability Layer', detail: 'API / MCP / Skills' },
        { title: '③ Runtime Layer', detail: 'Isolation / Browser / Filesystem' },
        { title: '④ Governance Layer', detail: 'Identity / Permission / Cost / Audit' },
      ],
    });
  });

  it('supports the intentionally limited simple Mermaid flow subset', () => {
    const vertical = `
flowchart TD
A["Agent"]
B["Sandbox<br/>Boundary"]
C["Tool"]
A --> B --> C
`;

    const horizontal = `
graph LR
A[Input]
B(Process)
C{Output}
A --> B --> C
`;

    expect(parseSimpleMermaidFlow(vertical)).toEqual({
      kind: 'flow',
      direction: 'vertical',
      nodes: ['Agent', 'Sandbox · Boundary', 'Tool'],
    });

    expect(parseSimpleMermaidFlow(horizontal)).toEqual({
      kind: 'flow',
      direction: 'horizontal',
      nodes: ['Input', 'Process', 'Output'],
    });
  });

  it('rejects complex Mermaid instead of rendering it incorrectly', () => {
    expect(parseSimpleMermaidFlow(`
sequenceDiagram
Alice->>Bob: Hello
`)).toBeNull();

    expect(parseSimpleMermaidFlow(`
flowchart TD
A --> B
A --> C
`)).toBeNull();
  });

  it('does not convert ordinary prose or malformed text blocks', () => {
    expect(parseLegacyText('This is a normal code block.')).toBeNull();
    expect(parseLegacyText('A\n↓\nB\n↓')).toBeNull();
    expect(parseLegacyText('① Context Layer\nOnly one layer')).toBeNull();
  });
});
