import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  // pdfkit/blob-stream (Etapa 8) esperam um ambiente meio-Node (referenciam
  // `global`, que não existe no navegador/renderer) — polyfill padrão do Vite.
  define: {
    global: 'globalThis',
  },
  plugins: [
    react(),
    // Só util/stream/buffer, que é o que blob-stream realmente usa — não
    // inclui o polyfill de `crypto` (traz uma dependência transitiva com
    // vulnerabilidade conhecida em `elliptic`, e nada aqui usa Node crypto).
    nodePolyfills({ include: ['util', 'stream', 'buffer'] }),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      preload: {
        input: 'electron/preload.ts',
      },
    }),
  ],
});
