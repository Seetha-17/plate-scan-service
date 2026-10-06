import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configure a unified proxy bridge connection point
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Points to your background Python FastAPI engine port
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
