export type TopicKey = 'ai-agent' | 'mcp' | 'rag' | 'claude-code' | 'security' | 'nextjs';

export const featuredTopics: Array<{
  key: TopicKey;
  label: string;
  description: string;
  keywords: string[];
}> = [
  {
    key: 'ai-agent',
    label: 'AI Agent',
    description: 'Agent architecture, runtime, tools and operations',
    keywords: ['ai agent', 'agent', 'エージェント', 'agentcore', 'computer-using'],
  },
  {
    key: 'mcp',
    label: 'MCP',
    description: 'Model Context Protocol, tools and integrations',
    keywords: ['mcp', 'model context protocol'],
  },
  {
    key: 'rag',
    label: 'RAG',
    description: 'Retrieval, knowledge bases and GraphRAG',
    keywords: ['rag', 'graphrag', 'knowledge base', 'retrieval'],
  },
  {
    key: 'claude-code',
    label: 'Claude Code',
    description: 'Coding agent workflow, runtime and governance',
    keywords: ['claude code'],
  },
  {
    key: 'security',
    label: 'Security',
    description: 'Agent security, permissions and vulnerabilities',
    keywords: ['security', '脆弱', 'vulnerability', 'rce', 'permission', '権限', 'iam', 'sandbox', 'prompt injection', 'sbom', 'audit'],
  },
  {
    key: 'nextjs',
    label: 'Next.js',
    description: 'Next.js, React framework and frontend engineering',
    keywords: ['next.js', 'nextjs'],
  },
];

export function topicMatches(item: any, topic: (typeof featuredTopics)[number]) {
  const text = [item?.title, item?.topic, item?.why]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return topic.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function countTopicArticles(reports: any[], topic: (typeof featuredTopics)[number]) {
  return reports.reduce(
    (count, report) => count + (report.data.top ?? []).filter((item: any) => topicMatches(item, topic)).length,
    0,
  );
}
