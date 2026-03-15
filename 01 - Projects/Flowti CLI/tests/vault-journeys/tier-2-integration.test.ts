/**
 * tier-2-integration.test.ts — Tier 2 integration runner for vault-test journeys.
 *
 * Loads .journey files from the tier-2-integration directory, provisions an
 * ephemeral vault per journey, and runs each step through the journey
 * executor. Setup/teardown are managed manually via beforeEach/afterEach
 * so the env passed to runStep is stripped of lifecycle hooks.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadAllJourneys } from "../../src/domain/e2e/journey/journey-loader.js";
import {
	runStep,
	setToolDeps,
	createDefaultDeps,
} from "../../src/domain/e2e/journey/journey-test-runner.js";
import { BASE_TOOLS } from "../../src/domain/e2e/journey/journey-tools.js";
import { createVaultTestProvider } from "../../src/domain/e2e/journey/providers/vault-test-provider.js";
import { createDefaultDeps as createInfraDeps } from "../../src/infrastructure/deps.js";
import type { JourneyExecutorOptions } from "../../src/domain/e2e/journey/journey-types.js";
import type { JourneyStep } from "../../src/domain/e2e/journey/journey-types.js";

const readFile = (p: string) => readFileSync(p, "utf-8");
const listFiles = (d: string) =>
	readdirSync(d).filter((f: string) => f.endsWith(".journey"));
const journeysDir = join(import.meta.dirname, "tier-2-integration");
const journeys = loadAllJourneys(readFile, listFiles, journeysDir);
const infraDeps = createInfraDeps();

const cliProjectRoot = join(import.meta.dirname, "../..");
const templateDir = join(cliProjectRoot, "tests/vault-template");
const binSrc = join(cliProjectRoot, "../../.flowti/bin/main.js");

for (const journey of journeys) {
	describe(`[Tier 2] ${journey.journey}`, () => {
		const provider = createVaultTestProvider({ templateDir, binSrc });
		let opts: JourneyExecutorOptions;

		beforeEach(async () => {
			opts = { variables: { templateDir, binSrc } };
			const deps = createDefaultDeps(infraDeps);
			await provider.setup!(deps, opts);
			setToolDeps(deps);
		});

		afterEach(async () => {
			const deps = createDefaultDeps(infraDeps);
			await provider.teardown!(deps);
		});

		const strippedEnv = {
			tools: { ...BASE_TOOLS, ...provider.tools },
		};

		for (const step of journey.steps) {
			it(step.title, async () => {
				const result = await runStep(step as JourneyStep, opts, strippedEnv);
				expect(result.status).toBe("pass");
			});
		}
	});
}
