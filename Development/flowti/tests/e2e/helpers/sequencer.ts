/**
 * Alphabetical test file sequencer for E2E tests.
 *
 * Ensures test files run in filename order so numeric prefixes
 * (00-, 10-, 20-, 30-, 40-) control execution sequence.
 *
 * Order: prerequisites → installer → journeys
 *
 * When E2E_JOURNEY is set, only the matching journey files (plus
 * prerequisites) are included. Supports comma-separated values.
 *
 * Examples:
 *   E2E_JOURNEY=installer                        → 00- + 10-installer
 *   E2E_JOURNEY=getting-started                   → 00- + 30-journey-getting-started
 *   E2E_JOURNEY=component-library                 → 00- + 40-journey-component-library
 *   E2E_JOURNEY=getting-started,component-library → 00- + 30- + 40-
 *   E2E_JOURNEY=installer,getting-started         → 00- + 10- + 30-
 */
import { BaseSequencer } from "vitest/node";
import type { TestSpecification } from "vitest/node";

export class AlphabeticalSequencer extends BaseSequencer {
	async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
		const sorted = [...files].sort((a, b) =>
			a.moduleId.localeCompare(b.moduleId),
		);

		const journey = process.env.E2E_JOURNEY;
		if (!journey) return sorted;

		const requested = journey.split(",").map((j) => j.trim());

		return sorted.filter((f) => {
			const basename = f.moduleId.split("/").pop() ?? "";
			// Always keep prerequisites
			if (basename.startsWith("00-")) return true;
			// Keep installer if explicitly requested
			if (requested.includes("installer") && basename.startsWith("10-")) return true;
			// Match journey files by name
			for (const name of requested) {
				if (name !== "installer" && basename.includes(`journey-${name}`)) return true;
			}
			return false;
		});
	}
}
