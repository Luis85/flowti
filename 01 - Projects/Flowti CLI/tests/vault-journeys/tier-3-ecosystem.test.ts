/**
 * tier-3-ecosystem.test.ts — Tier 3 ecosystem test runner for vault journeys.
 *
 * Loads all .journey files from tier-3-ecosystem/ and runs each step as a
 * Vitest test case. Uses the vault-test provider for setup/teardown.
 *
 * Run via: npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-3-ecosystem.test.ts
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadAllJourneys } from "../../src/domain/e2e/journey/journey-loader.js";
import {
	runStep,
	setToolDeps,
	createDefaultDeps,
} from "../../src/domain/e2e/journey/journey-test-runner.js";
import { createVaultTestProvider } from "../../src/domain/e2e/journey/providers/vault-test-provider.js";
import { createDefaultDeps as createInfraDeps } from "../../src/infrastructure/deps.js";
import { BASE_TOOLS } from "../../src/domain/e2e/journey/journey-tools.js";
import type { JourneyExecutorOptions } from "../../src/domain/e2e/journey/journey-types.js";
import type { ResolvedEnvironment } from "../../src/domain/e2e/journey/journey-executor.js";

const readFile = (p: string) => readFileSync(p, "utf-8");
const listFiles = (d: string) =>
	readdirSync(d).filter((f) => f.endsWith(".journey"));
const journeysDir = join(import.meta.dirname, "tier-3-ecosystem");
const journeys = loadAllJourneys(readFile, listFiles, journeysDir);
const infraDeps = createInfraDeps();

const cliProjectRoot = join(import.meta.dirname, "../..");
const templateDir = join(cliProjectRoot, "tests/vault-template");
const binSrc = join(cliProjectRoot, "../../.flowti/bin/main.js");

for (const journey of journeys) {
	describe(`[Tier 3] ${journey.journey}`, () => {
		let opts: JourneyExecutorOptions;
		const provider = createVaultTestProvider({ templateDir, binSrc });

		const strippedEnv: ResolvedEnvironment = {
			tools: { ...BASE_TOOLS, ...provider.tools },
		};

		beforeEach(async () => {
			opts = { variables: { templateDir, binSrc } };
			const deps = createDefaultDeps(infraDeps);
			await provider.setup!(deps, opts);
			setToolDeps(deps);
		});

		for (const step of journey.steps) {
			it(step.title, async () => {
				const result = await runStep(step, opts, strippedEnv);
				expect(result.status).toBe("pass");
			});
		}

		afterEach(async () => {
			const deps = createDefaultDeps(infraDeps);
			await provider.teardown!(deps);
		});
	});
}
