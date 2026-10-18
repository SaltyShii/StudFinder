import { defineConfig } from 'vite';

export default defineConfig({
	esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
	resolve: { alias: { 'node:assert': new URL('./src/assert-shim.ts', import.meta.url).pathname } },
	// The sim expects Node's `global` and an esbuild-defined CC_GLOBAL; false matches the tested (Node) behaviour.
	define: { global: 'globalThis', CC_GLOBAL: 'false' },
	worker: { format: 'es' },
});
