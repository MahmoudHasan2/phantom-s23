import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: 'localhost',
    port: 5173,
    open: true,
  },
  preview: {
    host: 'localhost',
    port: 4173,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
