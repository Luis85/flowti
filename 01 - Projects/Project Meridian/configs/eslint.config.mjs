import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './configs/tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/strict-boolean-expressions': 'error',
			// import/no-cycle deferred — eslint-plugin-import lacks stable ESLint 9 flat-config support
			'max-lines': ['warn', { max: 350, skipBlankLines: true, skipComments: true }],
			'complexity': ['warn', 10],
			'no-console': 'warn',
			'no-var': 'error',
			'prefer-const': 'error',
			'no-restricted-properties': [
				'error',
				{
					property: 'innerHTML',
					message: 'Use DOM API (createEl, createDiv, classList.add) instead of innerHTML (Obsidian security guideline)',
				},
				{
					property: 'outerHTML',
					message: 'Use DOM API instead of outerHTML (Obsidian security guideline)',
				},
				{
					property: 'insertAdjacentHTML',
					message: 'Use DOM API instead of insertAdjacentHTML (Obsidian security guideline)',
				},
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'TryStatement',
					message: 'Use Result type instead of try/catch (GDD §16.2)',
				},
			],
			'no-restricted-globals': [
				'error',
				{ name: 'require', message: 'Use ESM imports' },
			],
		},
	},
	{
		// Infrastructure boundary code may use try/catch to wrap external APIs that throw
		files: ['src/infrastructure/**/*.ts'],
		rules: {
			'no-restricted-syntax': 'off',
			'no-console': 'off',
		},
	},
	{
		// Tests may use console for debugging
		files: ['tests/**/*.ts'],
		rules: {
			'no-console': 'off',
		},
	},
	{
		files: ['src/domain/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../infrastructure/*', '../../infrastructure/*'], message: 'Domain must not import infrastructure (GDD §36.3)' },
						{ group: ['obsidian', 'node:*'], message: 'Domain must not import platform modules (GDD §36.3)' },
					],
				},
			],
		},
	},
	{
		files: ['src/ui/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../domain/*', '../../domain/*'], message: 'UI must not import domain internals — use Pinia stores (GDD §36.3)' },
					],
				},
			],
		},
	},
	{
		// Obsidian isolation boundary (GDD §36.4, ADR-19)
		// 'obsidian' import allowed ONLY in: main.ts, *-view.ts, settings-tab.ts, obsidian-*-adapter.ts
		files: ['src/**/*.ts'],
		ignores: [
			'src/main.ts',
			'src/plugin.ts',
			'src/infrastructure/engine/*-view.ts',
			'src/infrastructure/settings/settings-tab.ts',
			'src/infrastructure/vault/obsidian-*.ts',
			'src/infrastructure/platform/obsidian-*.ts',
			'src/domain/**/*.ts',
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [{ name: 'obsidian', message: 'Obsidian API only allowed in main.ts, views, settings-tab, and obsidian-* adapters (GDD §36.4, ADR-19)' }],
				},
			],
		},
	},
];
