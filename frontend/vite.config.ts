import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Backend en :3001 (no :3000, para no chocar con otros servicios locales como Docker).
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
