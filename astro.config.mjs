import { defineConfig } from 'astro/config';

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
        "media-src 'self'",
        "connect-src 'self'",
        "worker-src 'none'",
        "manifest-src 'self'",
        'upgrade-insecure-requests'
      ],
      scriptDirective: {
        resources: [
          "'self'",
          { resource: "'none'", kind: 'attribute' }
        ]
      },
      styleDirective: {
        resources: [
          "'self'",
          { resource: "'unsafe-inline'", kind: 'attribute' }
        ]
      }
    }
  },
  markdown: {
    shikiConfig: { theme: 'github-light' }
  }
});
