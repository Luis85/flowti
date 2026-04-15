import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import vueparser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';
import obsidianmd from 'eslint-plugin-obsidianmd';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const vueRecommendedRules = Object.assign(
	{},
	...(vuePlugin.configs['flat/recommended'] ?? []).map((c) => c.rules ?? {}),
);

const sharedTsRules = {
	'@typescript-eslint/no-explicit-any': 'error',
	'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
	'@typescript-eslint/strict-boolean-expressions': 'error',
	'@typescript-eslint/no-floating-promises': 'error',
	'@typescript-eslint/no-misused-promises': 'error',
	'@typescript-eslint/require-await': 'error',
	'@typescript-eslint/await-thenable': 'error',
	'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
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
	'@typescript-eslint/no-unnecessary-type-parameters': 'error',
	'@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
	'@typescript-eslint/no-redundant-type-constituents': 'error',
	'@typescript-eslint/no-useless-constructor': 'error',
	'eqeqeq': ['error', 'always'],
	'no-var': 'error',
	'prefer-const': 'error',
};

const noRestrictedDomElements = [
	'error',
	{ property: 'innerHTML', message: 'Use DOM API (createEl, createDiv, setText, classList) instead of innerHTML' },
	{ property: 'outerHTML', message: 'Use DOM API instead of outerHTML' },
	{ property: 'insertAdjacentHTML', message: 'Use DOM API instead of insertAdjacentHTML' },
];

const noTryCatchOutsideInfra = [
	'error',
	{ selector: 'TryStatement', message: 'Use Result type instead of try/catch outside src/infrastructure/** (spec §2.2 rule 4)' },
	{ selector: "UnaryExpression[operator='delete']", message: 'Use obj[key] = undefined instead of delete' },
];

export default [
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './configs/tsconfig.lint.json',
				tsconfigRootDir: projectRoot,
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
			'obsidianmd': obsidianmd,
		},
		rules: {
			...(obsidianmd.configs?.recommended?.rules ?? {}),
			'obsidianmd/ui/sentence-case': ['warn', { brands: ['Agentonomous'] }],
			...sharedTsRules,
			'max-lines': ['warn', { max: 350, skipBlankLines: true, skipComments: true }],
			'complexity': ['warn', 10],
			'no-console': 'warn',
			'no-restricted-properties': noRestrictedDomElements,
			'no-restricted-syntax': noTryCatchOutsideInfra,
			'no-restricted-globals': [
				'error',
				{ name: 'require', message: 'Use ESM imports' },
			],
		},
	},
	{
		files: ['tests/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: './configs/tsconfig.lint.json',
				tsconfigRootDir: projectRoot,
			},
		},
		plugins: { '@typescript-eslint': tseslint },
		rules: {
			...sharedTsRules,
			'no-console': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},
	{
		files: ['**/*.vue'],
		languageOptions: {
			parser: vueparser,
			parserOptions: {
				parser: tsparser,
				project: './configs/tsconfig.lint.json',
				tsconfigRootDir: projectRoot,
				extraFileExtensions: ['.vue'],
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
		},
		plugins: {
			'vue': vuePlugin,
			'@typescript-eslint': tseslint,
		},
		rules: {
			...vueRecommendedRules,
			...sharedTsRules,
			'no-restricted-properties': noRestrictedDomElements,
			// Repo convention: tabs, not spaces
			'vue/html-indent': ['error', 'tab'],
			// Singleline content formatting — allow inline text in simple elements
			'vue/singleline-html-element-content-newline': 'off',
			// Allow single-word page component names (Home, About) in page files
			'vue/multi-word-component-names': 'off',
			// Allow multiple attributes per line for concise bindings
			'vue/max-attributes-per-line': ['warn', { singleline: 3, multiline: 1 }],
			// eslint-plugin-vue 10.x flat config: comment-directive emits internal "clear"
			// markers as errors; disable until upstream fix lands
			'vue/comment-directive': 'off',
		},
	},
	{
		files: ['src/infrastructure/**/*.ts'],
		rules: {
			'no-restricted-syntax': 'off',
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
						{ group: ['../infrastructure/*', '../../infrastructure/*'], message: 'Domain must not import infrastructure (spec §2.2 rule 1)' },
						{ group: ['obsidian', 'node:*'], message: 'Domain must not import platform modules' },
						{ group: ['vue', 'pinia', 'vue-router', '@vue/reactivity'], message: 'Domain must not import Vue — domain is plain TypeScript' },
					],
				},
			],
		},
	},
	{
		files: ['src/ui/**/*.ts', 'src/ui/**/*.vue'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['../infrastructure/*', '../../infrastructure/*', '../../../infrastructure/*'], message: 'UI must not import infrastructure — use stores + ports (invariant 18)' },
					],
				},
			],
		},
	},
	{
		files: ['src/**/*.ts'],
		ignores: [
			'src/main.ts',
			'src/plugin.ts',
			'src/infrastructure/obsidian/**/*.ts',
			'src/infrastructure/views/*-view.ts',
			'src/infrastructure/settings/settings-tab.ts',
			'src/infrastructure/ribbon/ribbon.ts',
			'src/domain/**/*.ts',
		],
		rules: {
			'no-restricted-imports': [
				'error',
				{ paths: [{ name: 'obsidian', message: 'Obsidian only allowed in allowlist (spec §2.2 rule 3)' }] },
			],
		},
	},
];
