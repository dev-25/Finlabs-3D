import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// GitHub Pages serves this project at https://dev-25.github.io/Finlabs-3D/,
// so production URLs need that prefix. The dev server keeps serving from /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Finlabs-3D/' : '/',
  build: {
    rollupOptions: {
      input: {
        products: resolve(__dirname, 'index.html'),
        services: resolve(__dirname, 'services.html'),
        solutions: resolve(__dirname, 'solutions.html'),
      },
    },
  },
}));
