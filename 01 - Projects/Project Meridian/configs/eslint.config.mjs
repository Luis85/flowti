import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import obsidianmd from 'eslint-plugin-obsidianmd';

/** Shared TypeScript rules for both src/ and tests/ */
const sharedTsRules = {
	'@typescript-eslint/no-explicit-any': 'error',
	'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
	'@typescript-eslint/strict-boolean-expressions': 'error',
	'@typescript-eslint/no-floating-promises': 'error',
	'@typescript-eslint/no-misused-promises': 'error',
	'@typescript-eslint/require-await': 'error',
	'@typescript-eslint/await-thenable': 'error',
	'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
	// Agentic code quality — catch common AI code-gen mistakes
	'@typescript-eslint/no-unnecessary-condition': 'error',
	'@typescript-eslint/no-unsafe-return': 'error',
	'@typescript-eslint/no-unsafe-assignment': 'error',
	'@typescript-eslint/no-unsafe-argument': 'error',
	'@typescript-eslint/no-unsafe-member-access': 'error',
	'@typescript-eslint/no-unsafe-call': 'error',
	'@typescript-eslint/no-misused-spread': 'error',
	'@typescript-eslint/restrict-template-expressions': 'error',
	'@typescript-eslint/no-base-to-string': 'error',
	'@typescript-eslint/return-await': ['error', 'in-try-catch'],
	'@typescript-eslint/only-throw-error': 'error',
	'@typescript-eslint/no-confusing-void-expression': 'error',
	'@typescript-eslint/prefer-nullish-coalescing': 'error',
	'@typescript-eslint/prefer-optional-chain': 'error',
	'@typescript-eslint/no-unnecessary-type-assertion': 'error',
	'@typescript-eslint/no-duplicate-type-constituents': 'error',
	// Additional strict-type-checked rules
	'@typescript-eslint/no-unnecessary-type-parameters': 'error',
	'@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
	'@typescript-eslint/no-redundant-type-constituents': 'error',
	'@typescript-eslint/no-useless-constructor': 'error',
	'eqeqeq': ['error', 'always'],
	'no-var': 'error',
	'prefer-const': 'error',
};

export default [
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './configs/tsconfig.lint.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
			'obsidianmd': obsidianmd,
		},
		rules: {
			...obsidianmd.configs?.recommended,
			'obsidianmd/ui/sentence-case': ['warn', { brands: ['Project Meridian'] }],
			...sharedTsRules,
			// import/no-cycle deferred — eslint-plugin-import lacks stable ESLint 9 flat-config support
			'max-lines': ['warn', { max: 350, skipBlankLines: true, skipComments: true }],
			'complexity': ['warn', 10],
			'no-console': 'warn',
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
				{
					selector: "UnaryExpression[operator='delete']",
					message: 'Use `obj[key] = undefined` instead of delete — consistent mutation pattern',
				},
			],
			'no-restricted-globals': [
				'error',
				{ name: 'require', message: 'Use ESM imports' },
			],
		},
	},
	{
		// Type-aware linting for tests
		files: ['tests/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './configs/tsconfig.lint.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...sharedTsRules,
			'no-console': 'off',
			// Tests often assign mock values that TypeScript sees as unsafe
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			// Tests may have unnecessary conditions in type-narrowing assertions
			'@typescript-eslint/no-unnecessary-condition': 'off',
			// Mock implementations of async interfaces don't need await
			'@typescript-eslint/require-await': 'off',
			// Tests use destructuring to omit fields: { removed: _omit, ...rest }
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
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
		// Infrastructure systems must not hardcode simulation tuning values
		files: ['src/infrastructure/systems/**/*.ts'],
		rules: {
			'no-magic-numbers': ['warn', {
				ignore: [0, 1, -1, 100, 1000],
				ignoreDefaultValues: true,
				ignoreClassFieldInitialValues: true,
			}],
			// Systems must be independent — no cross-system imports (Phase 1D learning)
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['./*-system', './*-system.js'], message: 'Infrastructure systems must not import each other — keeps systems independently testable and prevents coupling.' },
					],
				},
			],
		},
	},
	{
		// Domain schemas must not import domain systems — prevents circular dependencies
		files: ['src/domain/schemas/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../systems/*'], message: 'Schemas must not import systems — schemas define data shapes, systems consume them.' },
					],
				},
			],
		},
	},
	{
		// Domain + systems must use injected GameRNG, never Math.random (ADR-11, §8.11)
		files: ['src/domain/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../infrastructure/*', '../../infrastructure/*'], message: 'Domain must not import infrastructure (GDD §36.3)' },
						{ group: ['obsidian', 'node:*', 'excalibur'], message: 'Domain must not import platform modules (GDD §36.3)' },
						{ group: ['../systems/*'], message: 'Domain systems must not import each other — share types via component-data.ts or ranges.ts' },
					],
				},
			],
			'no-restricted-properties': [
				'error',
				{
					object: 'Math',
					property: 'random',
					message: 'Use injected GameRNG for deterministic simulation (ADR-11, §8.11). Math.random breaks replay and emergence tests.',
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
			'src/infrastructure/ui/*-view.ts',
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
