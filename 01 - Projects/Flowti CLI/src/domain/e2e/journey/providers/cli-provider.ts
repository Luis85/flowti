/**
 * cli-provider.ts — Environment provider for standalone CLI projects.
 *
 * Provides no extra tools beyond the base set. CLI projects run commands,
 * assert outputs, and test file artifacts — all covered by base tools.
 */

import type { EnvironmentProvider } from "../journey-environment.js";

export function createCliProvider(): EnvironmentProvider {
	return {
		target: "cli",
		label: "CLI Project",
		capabilities: ["command", "filesystem"],
		tools: {},
	};
}
