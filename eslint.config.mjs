import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';

export default tseslint.config(
	{ ignores: ['**/node_modules', '.claude', 'packages/sim', 'apps/**/dist'] },
	...tseslint.configs.recommended.map((c) => ({ ...c, files: ['**/*.ts', '**/*.tsx'] })),
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: { 'import-x': importX },
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'import-x/no-cycle': 'error',
		},
	},
	// packages stay free of UI so an API can wrap them later
	{
		files: ['packages/**/*.ts'],
		ignores: ['packages/sim/**'],
		rules: { 'no-restricted-imports': ['error', { patterns: ['preact*', 'react*', '**/apps/**'] }] },
	},
	// lineage is vendored (sync manually): enforce on new scoring code only, tests included
	{
		files: ['packages/scoring/src/**/*.ts'],
		rules: {
			'no-restricted-syntax': ['error', ...['Program', 'ExportNamedDeclaration'].map((parent) => ({
				selector: `${parent} > VariableDeclaration > VariableDeclarator[init.type=/^(Arrow)?FunctionExpression$/]`,
				message: 'Top-level functions use the function keyword',
			}))],
		},
	},
	// scripts are new code: tabs like the rest of the repo, so a stray 2-space file fails the gate
	{
		files: ['scripts/**/*.ts'],
		rules: { indent: ['error', 'tab'] },
	},
);
