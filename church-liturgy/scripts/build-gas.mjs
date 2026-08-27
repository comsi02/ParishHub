import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'dist/gas');

const htmlEntries = ['display.html', 'control.html'];

async function buildHtml(entry) {
  await build({
    configFile: false,
    plugins: [viteSingleFile()],
    build: {
      outDir,
      emptyOutDir: false,
      minify: true,
      rollupOptions: {
        input: resolve(root, entry),
      },
    },
  });
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const entry of htmlEntries) {
  console.log(`Building ${entry}...`);
  await buildHtml(entry);
}

cpSync(resolve(root, 'src/appsscript'), outDir, { recursive: true });
cpSync(resolve(root, 'appsscript.json'), resolve(outDir, 'appsscript.json'));

console.log(`\nGAS build complete → ${outDir}`);
