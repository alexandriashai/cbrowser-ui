/**
 * Build script for cbrowser-ui
 * Compiles CSS (minified), bundles JS, copies patches
 */

import { mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

// Ensure dist exists
mkdirSync(DIST, { recursive: true });
mkdirSync(join(DIST, 'themes'), { recursive: true });

// 1. Build main CSS (concatenate all source files and minify)
console.log('[build] Compiling CSS...');
const cssFiles = ['cbrowser-ui.css', 'components.css', 'beauty.css'];
const mainCSS = cssFiles
  .map(f => readFileSync(join(SRC, 'css', f), 'utf-8'))
  .join('\n\n');
writeFileSync(join(DIST, 'cbrowser-ui.css'), mainCSS);

// Minified version
const minCSS = mainCSS
  .replace(/\/\*[\s\S]*?\*\//g, '') // remove comments
  .replace(/\s+/g, ' ')            // collapse whitespace
  .replace(/\s*([{}:;,])\s*/g, '$1') // remove space around syntax
  .replace(/;}/g, '}')             // remove last semicolons
  .trim();
writeFileSync(join(DIST, 'cbrowser-ui.min.css'), minCSS);
console.log(`  cbrowser-ui.css: ${(mainCSS.length / 1024).toFixed(1)}kb → ${(minCSS.length / 1024).toFixed(1)}kb min`);

// 2. Copy patches
console.log('[build] Copying patches...');
const patches = readdirSync(join(SRC, 'patches')).filter(f => f.endsWith('.css'));
for (const patch of patches) {
  copyFileSync(join(SRC, 'patches', patch), join(DIST, patch));
  const size = readFileSync(join(SRC, 'patches', patch)).length;
  console.log(`  ${patch}: ${(size / 1024).toFixed(1)}kb`);
}

// 3. Build JS
console.log('[build] Bundling JS...');
const result = await Bun.build({
  entrypoints: [join(SRC, 'js', 'cbrowser-ui.ts')],
  outdir: DIST,
  format: 'esm',
  minify: true,
  sourcemap: 'external',
  naming: 'cbrowser-ui.mjs',
});

if (!result.success) {
  console.error('[build] JS build failed:', result.logs);
  process.exit(1);
}

// Also build CJS version
const cjsResult = await Bun.build({
  entrypoints: [join(SRC, 'js', 'cbrowser-ui.ts')],
  outdir: DIST,
  format: 'cjs',
  minify: true,
  naming: 'cbrowser-ui.js',
});

if (!cjsResult.success) {
  console.error('[build] CJS build failed:', cjsResult.logs);
  process.exit(1);
}

// Generate type declaration stub
const dts = `/**
 * cbrowser-ui — Accessibility runtime
 */
export declare class FocusTrap {
  constructor(el: HTMLElement, options?: TrapOptions);
  activate(): void;
  deactivate(): void;
}
export interface TrapOptions {
  onEscape?: () => void;
  initialFocus?: HTMLElement | string;
  returnFocus?: boolean;
}
export interface ToastOptions {
  duration?: number;
  pauseOnHover?: boolean;
  pauseOnFocus?: boolean;
  role?: 'status' | 'alert';
}
export type ColorScheme = 'light' | 'dark' | 'system';
export declare function initArrowNav(container: HTMLElement, options?: { selector?: string; orientation?: 'horizontal' | 'vertical' | 'both'; wrap?: boolean }): void;
export declare function prefersReducedMotion(): boolean;
export declare function onMotionPreferenceChange(callback: (reduced: boolean) => void): () => void;
export declare function setColorScheme(scheme: ColorScheme): void;
export declare function getColorScheme(): ColorScheme;
export declare function createToast(message: string, container: HTMLElement, options?: ToastOptions): { dismiss: () => void; el: HTMLElement };
export declare function autoInit(): void;
`;
writeFileSync(join(DIST, 'cbrowser-ui.d.ts'), dts);

console.log('[build] Done.');
