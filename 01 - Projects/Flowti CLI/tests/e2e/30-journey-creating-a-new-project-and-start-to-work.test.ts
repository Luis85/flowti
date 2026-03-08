import { describe, it } from "vitest";

// E2E journey tests require a running Obsidian instance.
// Run via: npm run test:e2e -- --journey=creating-a-new-project-and-start-to-work
//
// To execute manually:
//   1. Start Obsidian with the test vault
//   2. npx vitest run tests/e2e/<this-file> --config configs/vitest.config.ts
//
// The journey definition is loaded from: tests/e2e/journeys/creating-a-new-project-and-start-to-work.journey

describe.skip("Journey: creating-a-new-project-and-start-to-work", () => {
	it("executes the creating-a-new-project-and-start-to-work journey", () => {
		// Implementation requires journeyExecutor helper and a running Obsidian instance
		// Remove .skip and uncomment below to run:
		//
		// const { executeJourney } = await import("./helpers/journeyExecutor");
		// const fs = await import("node:fs");
		// const path = await import("node:path");
		// const configPath = path.join(__dirname, "journeys", "creating-a-new-project-and-start-to-work.journey");
		// const definition = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		// await executeJourney(definition);
	});
});
