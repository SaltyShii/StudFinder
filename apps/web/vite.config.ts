import { defineConfig } from 'vite';

export default defineConfig({
	esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
	resolve: { alias: { 'node:assert': new URL('./src/assert-shim.ts', import.meta.url).pathname } },
	worker: { format: 'es' },
});
