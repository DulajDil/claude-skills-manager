import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from 'tailwindcss';

const here = path.dirname(fileURLToPath(import.meta.url));

export default {
  content: [path.join(here, 'index.html'), path.join(here, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: { DEFAULT: '#f7f4ee', raised: '#fdfbf7', sunk: '#efebe3', selected: '#ebe5da' },
        line: { DEFAULT: '#e3ddd2', strong: '#d3ccbf' },
        ink: { DEFAULT: '#2b2925', soft: '#5f5a52', faint: '#8f897f' },
        accent: { DEFAULT: '#3d6fa8', soft: '#e8f0fa' },
      },
    },
  },
} satisfies Config;
