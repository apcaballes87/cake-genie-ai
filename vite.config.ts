import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      external: [
        '@google/genai',
        '@supabase/auth-helpers-nextjs',
        'lodash',
        'lodash/',
        'next/',
        'vite',
        '@vitejs/plugin-react',
        'crypto'
      ],
      output: {
        manualChunks: {
          'react-core': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
          'query': ['@tanstack/react-query'],
          'ui-heavy': ['react-hot-toast'],
          'utils': ['uuid', 'browser-image-compression'],
        },
      },
    },
    // Report compressed size and set warning limit
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js', '@tanstack/react-query', 'browser-image-compression'],
    exclude: []
  },
});