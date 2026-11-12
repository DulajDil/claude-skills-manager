import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import tailwind from 'tailwindcss';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const api = `http://127.0.0.1:${process.env.WORKFLOW_CONSOLE_PORT || 3020}`;

export default defineConfig({
  root: here,
  plugins: [react()],
  // One React for the app and every dependency (react-markdown etc.), even across dep re-optimisation.
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react-markdown', 'remark-gfm', 'lucide-react', 'yaml', 'zod'] },
  css: { postcss: { plugins: [tailwind({ config: path.join(here, 'tailwind.config.ts') }), autoprefixer()] } },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.WORKFLOW_CONSOLE_WEB_PORT || 5280),
    strictPort: true,
    fs: { allow: [path.resolve(here, '..')] },
    proxy: { '/api': { target: api, changeOrigin: false } },
  },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true },
});
