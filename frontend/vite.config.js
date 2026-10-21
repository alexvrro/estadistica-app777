import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Redirige /api al backend Express durante el desarrollo (evita problemas de CORS)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
