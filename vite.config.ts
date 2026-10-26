import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let configuredPath = env.APP_BASE_PATH?.trim() || '';
  if (/^https?:\/\//i.test(configuredPath)) {
    const url = new URL(configuredPath);
    if (url.search || url.hash) {
      throw new Error('APP_BASE_PATH must not contain a query string or fragment.');
    }
    configuredPath = url.pathname;
  }
  if (configuredPath.includes('?') || configuredPath.includes('#')) {
    throw new Error('APP_BASE_PATH must be a plain URL path without query strings or fragments.');
  }
  const pathSegments = configuredPath.split('/').filter(Boolean);
  if (pathSegments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('APP_BASE_PATH must be a plain URL path without query strings or fragments.');
  }
  const basePath = pathSegments.length ? `/${pathSegments.join('/')}` : '';
  const apiPrefix = `${basePath}/api` || '/api';

  return {
    base: `${basePath || ''}/`,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        [apiPrefix]: {
          target: 'http://localhost:3001',
          rewrite: (requestPath) => requestPath.startsWith(apiPrefix) ? `/api${requestPath.slice(apiPrefix.length)}` : requestPath,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
