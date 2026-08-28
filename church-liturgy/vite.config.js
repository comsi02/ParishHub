import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // viteSingleFile 제거: Firebase Hosting은 별도 JS/CSS 파일 지원
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        display: resolve(__dirname, 'display.html'),
        control: resolve(__dirname, 'control.html'),
      },
    },
  },
});
