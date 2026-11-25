import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import {defineConfig} from 'vite';

function buildExtensionScriptsPlugin() {
  return {
    name: 'tavriqelo-extension-scripts',
    apply: 'build' as const,
    async closeBundle(error?: Error): Promise<void> {
      if (error) {
        return;
      }

      const rootDir = import.meta.dirname;
      const distDir = path.resolve(rootDir, 'dist');

      // 1. Bundle content script as a self-contained IIFE (Manifest V3 requirement for classic content_scripts)
      await esbuild.build({
        entryPoints: [path.resolve(rootDir, 'src/content/index.ts')],
        outfile: path.resolve(distDir, 'content.js'),
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: ['chrome114'],
        minify: true,
        sourcemap: false,
        define: {
          'process.env.NODE_ENV': '"production"',
        },
      });

      // 2. Bundle background service worker as a self-contained ES module
      await esbuild.build({
        entryPoints: [path.resolve(rootDir, 'src/background/index.ts')],
        outfile: path.resolve(distDir, 'background.js'),
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: ['chrome114'],
        minify: true,
        sourcemap: false,
        define: {
          'process.env.NODE_ENV': '"production"',
        },
      });

      // 3. Validate manifest.json and verify all referenced files exist in dist/
      const manifestPath = path.resolve(distDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Build verification failed: dist/manifest.json is missing.');
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const requiredFiles: string[] = [];

      if (manifest.action?.default_popup) {
        requiredFiles.push(manifest.action.default_popup);
      }
      if (manifest.options_page) {
        requiredFiles.push(manifest.options_page);
      }
      if (manifest.background?.service_worker) {
        requiredFiles.push(manifest.background.service_worker);
      }
      if (manifest.icons) {
        requiredFiles.push(...Object.values<string>(manifest.icons));
      }
      if (manifest.action?.default_icon) {
        requiredFiles.push(...Object.values<string>(manifest.action.default_icon));
      }
      if (Array.isArray(manifest.content_scripts)) {
        for (const cs of manifest.content_scripts) {
          if (Array.isArray(cs.js)) {
            requiredFiles.push(...cs.js);
          }
          if (Array.isArray(cs.css)) {
            requiredFiles.push(...cs.css);
          }
        }
      }

      const uniqueRequired = Array.from(new Set(requiredFiles));
      const missing = uniqueRequired.filter(
        (relPath) => !fs.existsSync(path.resolve(distDir, relPath)),
      );

      if (missing.length > 0) {
        throw new Error(
          `Build verification failed: Manifest references missing files in dist/: ${missing.join(', ')}`,
        );
      }
    },
  };
}

export default defineConfig(() => {
  const rootDir = import.meta.dirname;
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      buildExtensionScriptsPlugin(),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'chrome114',
      rollupOptions: {
        input: {
          index: path.resolve(rootDir, 'index.html'),
          popup: path.resolve(rootDir, 'popup.html'),
          options: path.resolve(rootDir, 'options.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
