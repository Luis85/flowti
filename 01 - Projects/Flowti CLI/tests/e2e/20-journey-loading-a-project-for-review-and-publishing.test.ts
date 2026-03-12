import { describe, it } from "vitest";

// E2E journey tests require a running Obsidian instance.
// Run via: npm run test:e2e -- --journey=loading-a-project-for-review-and-publishing
//
// To execute manually:
//   1. Start Obsidian with the test vault
//   2. npx vitest run tests/e2e/<this-file> --config configs/vitest.config.ts
//
// The journey definition is loaded from: tests/e2e/journeys/loading-a-project-for-review-and-publishing.journey

// Deferred to Phase 8.5 — requires E2E infrastructure migration from Plugin (TD-23)
describe.skip("Journey: loading-a-project-for-review-and-publishing", () => {
	it("executes the loading-a-project-for-review-and-publishing journey", () => {
		// Implementation requires journeyExecutor helper and a running Obsidian instance
		// Remove .skip and uncomment below to run:
		//
		// const { executeJourney } = await import("./helpers/journeyExecutor");
		// const fs = await import("node:fs");
		// const path = await import("node:path");
		// const configPath = path.join(__dirname, "journeys", "loading-a-project-for-review-and-publishing.journey");
		// const definition = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		// await executeJourney(definition);
	});
});
