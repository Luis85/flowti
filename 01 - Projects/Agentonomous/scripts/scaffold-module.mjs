#!/usr/bin/env node
/**
 * Scaffold a new Agentonomous module.
 *
 *   npm run scaffold:module -- <module-name>
 *
 * Creates:
 *   src/modules/<name>/
 *     <name>-module.ts       — Module definition (backend)
 *     <name>-settings.ts     — Settings type + defaults + validator (+schema example commented out)
 *     <name>-events.ts       — EventMap augmentation
 *     locales/en.json        — i18n messages
 *   tests/modules/<name>/
 *     <name>-module.test.ts
 *
 * The scaffolder does NOT wire the module into src/main.ts — do that
 * manually.  It also does NOT create a panel view (src/ui/panels/) or
 * ItemView wrapper (src/infrastructure/obsidian/views/); see
 * docs/module-authoring.md for the view flow.
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function die(message) {
	console.error(`[scaffold] ${message}`);
	process.exit(1);
}

const rawName = process.argv[2];
if (rawName === undefined || rawName.trim() === '') {
	die('Usage: npm run scaffold:module -- <module-name>  (e.g. my-feature)');
}

const name = rawName.trim();
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
	die(`module name must be kebab-case ([a-z][a-z0-9-]*), got "${name}"`);
}

const pascalName = name
	.split('-')
	.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
	.join('');
const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);

const moduleDir = join(projectRoot, 'src', 'modules', name);
const testDir = join(projectRoot, 'tests', 'modules', name);

if (existsSync(moduleDir)) die(`module already exists at ${moduleDir}`);

mkdirSync(join(moduleDir, 'locales'), { recursive: true });
mkdirSync(testDir, { recursive: true });

const SETTINGS_KEY = camelName;

const moduleFile = `import { defineModule } from '../../domain/shared/module.js';
import { ${pascalName.toUpperCase()}_DEFAULTS, validate${pascalName}Settings, type ${pascalName}Settings } from './${name}-settings.js';
import enMessages from './locales/en.json' with { type: 'json' };

export const ${pascalName}Module = defineModule<${pascalName}Settings>({
	id: '${name}',
	name: '${pascalName}',
	dependsOn: ['core'],
	settingsKey: '${SETTINGS_KEY}',
	settingsDefaults: ${pascalName.toUpperCase()}_DEFAULTS,
	validateSettings: validate${pascalName}Settings,
	messages: { en: enMessages },

	// settingsSchema: {
	//     title: '${pascalName}',
	//     fields: [
	//         { kind: 'toggle', key: 'enabled', label: 'Enabled' },
	//     ],
	// },

	init(ports, settings) {
		ports.logger.info('${name}', '${pascalName} module initialized');
		void settings;
		return Promise.resolve();
	},

	destroy() {},
});
`;

const settingsFile = `import { ok, err, type Result } from '../../domain/shared/result.js';

export type ${pascalName}Settings = {
	readonly enabled: boolean;
};

export const ${pascalName.toUpperCase()}_DEFAULTS: ${pascalName}Settings = {
	enabled: true,
};

export function validate${pascalName}Settings(raw: unknown): Result<${pascalName}Settings, string> {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return err('${name} settings must be an object');
	}
	const { enabled } = raw as Record<string, unknown>;
	if (typeof enabled !== 'boolean') return err('enabled must be boolean');
	return ok({ enabled });
}
`;

const eventsFile = `declare module '../../domain/shared/event-bus.js' {
	interface EventMap {
		'${name}': { action: string };
	}
}
`;

const localesFile = `{
	"${name}.notifications.hello": "${pascalName} is ready"
}
`;

const testFile = `import { describe, expect, it } from 'vitest';
import { ${pascalName}Module } from '../../../src/modules/${name}/${name}-module.js';
import { fakeModulePorts, fakeLogger } from '../../__fakes__/fake-ports.js';
import { ${pascalName.toUpperCase()}_DEFAULTS, validate${pascalName}Settings } from '../../../src/modules/${name}/${name}-settings.js';
import { isErr, isOk } from '../../../src/domain/shared/result.js';

describe('${pascalName}Module', () => {
	it('init logs and resolves', async () => {
		const logger = fakeLogger();
		const ports = fakeModulePorts({ logger });
		await ${pascalName}Module.init(ports, ${pascalName.toUpperCase()}_DEFAULTS);
		expect(logger.info).toHaveBeenCalledWith('${name}', expect.stringContaining('initialized'));
	});

	it('destroy runs without error', async () => {
		await expect(Promise.resolve(${pascalName}Module.destroy())).resolves.toBeUndefined();
	});
});

describe('validate${pascalName}Settings', () => {
	it('accepts valid settings', () => {
		const result = validate${pascalName}Settings({ enabled: true });
		expect(isOk(result)).toBe(true);
	});

	it('rejects non-object input', () => {
		expect(isErr(validate${pascalName}Settings(null))).toBe(true);
	});

	it('rejects missing or non-boolean enabled', () => {
		expect(isErr(validate${pascalName}Settings({}))).toBe(true);
	});
});
`;

writeFileSync(join(moduleDir, `${name}-module.ts`), moduleFile);
writeFileSync(join(moduleDir, `${name}-settings.ts`), settingsFile);
writeFileSync(join(moduleDir, `${name}-events.ts`), eventsFile);
writeFileSync(join(moduleDir, 'locales', 'en.json'), localesFile);
writeFileSync(join(testDir, `${name}-module.test.ts`), testFile);

console.log(`[scaffold] created src/modules/${name}/`);
console.log(`[scaffold] created tests/modules/${name}/`);
console.log('');
console.log('Next steps:');
console.log(`  1. Add to src/main.ts:`);
console.log(`       import { ${pascalName}Module } from './modules/${name}/${name}-module.js';`);
console.log(`       const modules = [CoreModule, EventInspectorModule, HealthMonitorModule, FileDetailModule, ${pascalName}Module];`);
console.log(`  2. Add to src/all-events.ts:`);
console.log(`       import './modules/${name}/${name}-events.js';`);
console.log(`  3. For a sidebar/main view:`);
console.log(`       - create src/ui/panels/${pascalName}Panel.vue`);
console.log(`       - create src/infrastructure/obsidian/views/${name}-view.ts`);
console.log(`       - export intent from the module's views field`);
console.log(`       - register in src/infrastructure/obsidian/views/index.ts`);
console.log(`  4. Run 'npm test' to verify everything passes.`);
