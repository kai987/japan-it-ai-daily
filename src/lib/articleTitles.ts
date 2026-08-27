const japaneseTitleOverrides: Record<string, string> = {
  'https://techblog.lycorp.co.jp/ja/20260826a': 'LINEヤフー「Agent i」：Agent BuilderとAgent Runtimeで使いやすさと本番安全性を両立する',
  'https://techblog.lycorp.co.jp/ja/20260826b': 'AI活用率100％のQA組織をつくるまで',
  'https://zenn.dev/microsoft/articles/copilot-enterprise-managed-settings0827': 'GitHub EnterpriseにおけるCopilotの統制：AI ControlsとManaged Settings',
  'https://tech.layerx.co.jp/entry/typespec-in-aiworkforce': 'REST APIにTypeSpecを導入したスキーマ駆動開発',
  'https://codezine.jp/news/detail/29461': 'JetBrains、ローカル環境向けAIコーディングエージェント「Junie Local」を公開',
};

export function getJapaneseArticleTitle(item: { title?: string; url?: string }) {
  if (item.url && japaneseTitleOverrides[item.url]) return japaneseTitleOverrides[item.url];
  return item.title ?? '';
}
