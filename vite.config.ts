import { defineConfig } from 'vite';

// GitHub Pages project site: https://tsedbr00.github.io/temple-heist/
export default defineConfig({
  base: '/temple-heist/',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
