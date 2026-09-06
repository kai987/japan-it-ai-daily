export type TopicKey = 'ai-agent' | 'mcp' | 'rag' | 'claude-code' | 'security' | 'nextjs';

export const featuredTopics: Array<{
  key: TopicKey;
  label: string;
  description: string;
  descriptionJa: string;
  keywords: string[];
}> = [
  {
    key: 'ai-agent',
    label: 'AI Agent',
    description: 'Agent architecture, runtime, tools and operations',
    descriptionJa: 'AIエージェントのアーキテクチャ、Runtime、Tool、運用設計',
    keywords: ['ai agent', 'agent', 'エージェント', 'agentcore', 'computer-using'],
  },
  {
    key: 'mcp',
    label: 'MCP',
    description: 'Model Context Protocol, tools and integrations',
    descriptionJa: 'Model Context Protocol、Tool連携、統合パターン',
    keywords: ['mcp', 'model context protocol'],
  },
  {
    key: 'rag',
    label: 'RAG',
    description: 'Retrieval, knowledge bases and GraphRAG',
    descriptionJa: '検索、Knowledge Base、GraphRAGを含むRAG設計',
    keywords: ['rag', 'graphrag', 'knowledge base', 'retrieval'],
  },
  {
    key: 'claude-code',
    label: 'Claude Code',
    description: 'Coding agent workflow, runtime and governance',
    descriptionJa: 'Coding AgentのWorkflow、Runtime、Governance',
    keywords: ['claude code'],
  },
  {
    key: 'security',
    label: 'Security',
    description: 'Agent security, permissions and vulnerabilities',
    descriptionJa: 'Agent Security、権限設計、脆弱性、監査',
    keywords: ['security', '脆弱', 'vulnerability', 'rce', 'permission', '権限', 'iam', 'sandbox', 'prompt injection', 'sbom', 'audit'],
  },
  {
    key: 'nextjs',
    label: 'Next.js',
    description: 'Next.js, React framework and frontend engineering',
    descriptionJa: 'Next.js、React Framework、Frontend Engineering',
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
