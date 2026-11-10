import { defineConfig } from 'vite';

export default defineConfig({
  // relative paths: the same build works on GitHub Pages (/portfolio-room/) and embedded in another site
  base: './',
  build: {
    target: 'es2022',
    assetsDir: 'static',   // built files; public/assets (photos, models, sounds) is copied as-is
    assetsInlineLimit: 0,   // keep fonts as cacheable files
    rollupOptions: {
      output: {
        // three.js in its own file: it rarely changes, so browsers keep it cached across updates of the studio
        manualChunks: id => (/node_modules[\/]three[\/]build[\/]/.test(id) ? 'three' : undefined),
      },
    },
  },
});
