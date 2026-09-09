import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        products: resolve(__dirname, 'index.html'),
        services: resolve(__dirname, 'services.html'),
      },
    },
  },
});
