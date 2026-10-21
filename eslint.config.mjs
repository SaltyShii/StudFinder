import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';

// `as unknown as T` defeats the type check; narrow or build a typed object instead
const noDoubleCast = {
	selector: 'TSAsExpression > TSAsExpression.expression[typeAnnotation.type="TSUnknownKeyword"]',
	message: 'Do not cast through unknown; narrow the value or build a typed object',
};

const functionKeyword = ['Program', 'ExportNamedDeclaration'].map((parent) => ({
	selector: `${parent} > VariableDeclaration > VariableDeclarator[init.type=/^(Arrow)?FunctionExpression$/]`,
	message: 'Top-level functions use the function keyword',
}));

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
		rules: { 'no-restricted-syntax': ['error', ...functionKeyword] },
	},
	// new source only: tests mock freely, lineage is vendored
	{
		files: ['packages/scoring/src/**/*.ts'],
		ignores: ['**/*.test.ts'],
		rules: { 'no-restricted-syntax': ['error', noDoubleCast, ...functionKeyword] },
	},
	{
		files: ['apps/web/src/**/*.{ts,tsx}'],
		ignores: ['**/*.test.{ts,tsx}'],
		rules: { 'no-restricted-syntax': ['error', noDoubleCast] },
	},
	// scripts are new code: tabs like the rest of the repo, so a stray 2-space file fails the gate
	{
		files: ['scripts/**/*.ts'],
		rules: { indent: ['error', 'tab'] },
	},
);
