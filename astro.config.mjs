import { defineConfig } from 'astro/config';

const verifiedInlineScripts = [
  "'sha256-Fy4Jj/MNW5fKhEX/U+HrnIZZL84Ngeq+w6YdWcwYHQE='", // initial theme
  "'sha256-NgF0ulOKuwYtbm1O82saYlAqPjWhJcOO3KUQh0Kav4c='", // theme/menu/TOC
  "'sha256-772VVZKuu8keoACuPl9AQOMhOo+x/J240SH9AUpOa4k='", // interview deep links
  "'sha256-GCoSn7zakHhIDak12g1Y5A93bTnh9dmH11x2vUR8zio='", // daily page enhancements
  "'sha256-MqSU29qsOKEZdKC7pyqhSJ0wrLHy7FH5b+vZYowt4Es='", // Japanese detail audio
  "'sha256-w/rH1rDzqZxHU9A6x6EOnjxUuhcEKhb7Frklu/x/0Ro='", // Japanese filters/pagination
  "'sha256-0YUCh+enit4vbZngKk0JSPWWFFnT7IWEsRAMKr6bP50='", // Interview filters/pagination
];

const configuredAudioBase = process.env.PUBLIC_AUDIO_BASE_URL?.trim() || '';
let externalAudioOrigin = '';

if (configuredAudioBase) {
  let audioUrl;
  try {
    audioUrl = new URL(configuredAudioBase);
  } catch {
    throw new Error('PUBLIC_AUDIO_BASE_URL must be a valid HTTPS URL');
  }

  if (audioUrl.protocol !== 'https:') {
    throw new Error('PUBLIC_AUDIO_BASE_URL must use HTTPS');
  }

  externalAudioOrigin = audioUrl.origin;
}

export default defineConfig({
  site: 'https://kai987.github.io',
  base: '/japan-it-ai-daily/',
  trailingSlash: 'always',
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "form-action 'none'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `media-src 'self'${externalAudioOrigin ? ` ${externalAudioOrigin}` : ''}`,
        "connect-src 'self'",
        "worker-src 'none'",
        "manifest-src 'self'",
        'upgrade-insecure-requests'
      ],
      scriptDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          ...verifiedInlineScripts.map((resource) => ({ resource, kind: 'element' })),
          { resource: "'none'", kind: 'attribute' }
        ]
      },
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          { resource: "'unsafe-inline'", kind: 'attribute' }
        ]
      }
    }
  },
  markdown: {
    syntaxHighlight: {
      type: 'prism',
      excludeLangs: ['mermaid', 'math']
    }
  }
});
