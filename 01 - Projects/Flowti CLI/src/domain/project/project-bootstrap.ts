/**
 * project-bootstrap.ts — Pure domain: generate flowti.config.json content.
 *
 * Takes wizard answers (build/test/lint commands, storybook framework)
 * and produces the config object to write to disk.
 */

export interface BootstrapInput {
	readonly build?: string;
	readonly test?: string;
	readonly lint?: string;
	readonly storybook?: string;
}

export interface BootstrapConfig {
	readonly build: { readonly commands: Record<string, string> };
	readonly test: { readonly commands: Record<string, string> };
	readonly devtools: { readonly lint: { readonly command?: string; readonly maxComplexity: number; readonly maxLines: number } };
	readonly components?: { readonly framework: string };
}

export function buildBootstrapConfig(input: BootstrapInput): BootstrapConfig {
	const buildCommands: Record<string, string> = {};
	if (input.build) buildCommands.full = input.build;

	const testCommands: Record<string, string> = {};
	if (input.test) testCommands.unit = input.test;

	const config: BootstrapConfig = {
		build: { commands: buildCommands },
		test: { commands: testCommands },
		devtools: {
			lint: {
				...(input.lint ? { command: input.lint } : {}),
				maxComplexity: 10,
				maxLines: 350,
			},
		},
		...(input.storybook ? { components: { framework: input.storybook } } : {}),
	};

	return config;
}
