/// <reference types="vitest/config" />

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  plugins: [
    devtools(),
    solidPlugin(),
    tailwindcss(),
    mode === 'analyze' && visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '^/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
  },
}));
