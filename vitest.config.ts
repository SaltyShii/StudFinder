import { defineConfig } from 'vitest/config';

// agent worktrees hold copies of the tests; running them gives false failures
export default defineConfig({ test: { exclude: ['**/node_modules/**', '.claude/**'] } });
