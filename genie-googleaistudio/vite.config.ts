import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
          'query': ['@tanstack/react-query'],
          'ui-heavy': ['react-hot-toast'],
          'utils': ['uuid'],
        },
      },
    },
    // Report compressed size and set warning limit
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js', '@tanstack/react-query'],
  },
});