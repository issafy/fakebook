import { defineConfig } from 'vite';

export default defineConfig({
  // Proxy /api calls to the Express server during development
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  // Build output goes to dist/
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
