import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Reset back to normal now that frontend points directly to the AWS cloud domain link
export default defineConfig({
  plugins: [react()],
});
