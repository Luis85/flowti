/**
 * test-vault.ts — In-memory test vault builder for vitest.
 *
 * Creates a mock filesystem pre-populated with the standard vault
 * structure (.flowti/config.json, .flowti/var/, projects folder).
 *
 * Usage:
 *   const vault = createMockTestVault("my-test");
 *   vault.fs.existsSync(vault.layout.configPath); // true
 */

import { createMockFs } from "../mocks/mock-fs.js";
import type { FlowtiCliConfig } from "../../src/infrastructure/types.js";
import {
	scaffoldTestVault,
	resolveTestVaultLayout,
	type TestVaultLayout,
} from "../../src/infrastructure/test-vault.js";

export interface MockTestVault {
	layout: TestVaultLayout;
	config: FlowtiCliConfig;
	fs: ReturnType<typeof createMockFs>;
}

export function createMockTestVault(name: string, opts?: {
	config?: Partial<FlowtiCliConfig>;
	projectsFolder?: string;
}): MockTestVault {
	const root = `/test-vaults/${name}`;
	const projectsFolder = opts?.projectsFolder ?? "01 - Projects";

	const config: FlowtiCliConfig = {
		version: "1.0.0",
		projectsFolder,
		...opts?.config,
	};

	const fs = createMockFs();
	const layout = scaffoldTestVault(root, { name, projectsFolder, config }, fs);

	return { layout, config, fs };
}
