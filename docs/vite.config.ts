import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    angular({
      tsconfig: './tsconfig.app.json',
    }),
  ],
  root: 'docs',
  resolve: {
    alias: {
      '@longtable/angular-spreadsheet': resolve(__dirname, '../longtable/src/public-api.ts'),
    },
  },
  publicDir: 'src/assets',
  build: {
    outDir: '../dist/docs',
    emptyOutDir: true,
  },
  server: {
    port: 4200,
  }
});
