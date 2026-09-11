import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    // 개별 청크가 500KB를 넘지 않도록 유지
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Firebase를 기능별 청크로 분리 (단일 파일 500KB 초과 방지)
          if (id.includes('node_modules/firebase/auth') || id.includes('node_modules/@firebase/auth')) {
            return 'firebase-auth';
          }
          if (
            id.includes('node_modules/firebase/firestore') ||
            id.includes('node_modules/@firebase/firestore')
          ) {
            return 'firebase-firestore';
          }
          if (
            id.includes('node_modules/firebase/') ||
            id.includes('node_modules/@firebase/')
          ) {
            return 'firebase-core';
          }
        },
      },
    },
  },
  server: {
    port: 5174,
  },
});
