import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: {
      input: {
        display: resolve(__dirname, 'display.html'),
        control: resolve(__dirname, 'control.html'),
      },
    },
  },
});
