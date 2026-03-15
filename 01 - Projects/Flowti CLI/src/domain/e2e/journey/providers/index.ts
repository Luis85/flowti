/**
 * providers/index.ts — Barrel export and default registry setup.
 *
 * Registers all built-in environment providers into a single registry.
 * Projects declare `requires.target`, the CLI resolves the matching provider.
 */

import { createEnvironmentRegistry } from "../journey-environment.js";
import type { EnvironmentRegistry, Capability } from "../journey-environment.js";
import { createCliProvider } from "./cli-provider.js";
import { createTypescriptProvider } from "./typescript-provider.js";
import { createObsidianVaultProvider } from "./obsidian-vault-provider.js";
import { createObsidianPluginProvider } from "./obsidian-plugin-provider.js";
import { createWebappProvider } from "./webapp-provider.js";
import { createVaultTestProvider } from "./vault-test-provider.js";

// ── Built-in capabilities ────────────────────────────────────────────

const builtInCapabilities: Capability[] = [
	{
		id: "command",
		name: "Shell Commands",
		description: "Execute shell commands and capture output",
		check: () => true,
	},
	{
		id: "filesystem",
		name: "File System",
		description: "Read, write, and check file existence",
		check: () => true,
	},
	{
		id: "frontmatter",
		name: "YAML Frontmatter",
		description: "Read, write, and assert YAML frontmatter in markdown files",
		check: () => true,
	},
	{
		id: "tsc-check",
		name: "TypeScript Check",
		description: "Run tsc --noEmit for type checking",
		check: (deps) => {
			try {
				const result = deps.exec("npx tsc --version", { timeout: 5000 });
				return result.exitCode === 0 ? true : "TypeScript not installed";
			} catch {
				return "TypeScript not available";
			}
		},
	},
	{
		id: "lint",
		name: "Linter",
		description: "Run project linter (eslint by default)",
		check: () => true,
	},
	{
		id: "obsidian-cli",
		name: "Obsidian CLI",
		description: "Execute Obsidian CLI commands (requires Obsidian 1.12+)",
		check: (deps) => {
			try {
				const result = deps.exec("obsidian-cli --version", { timeout: 5000 });
				return result.exitCode === 0 ? true : "Obsidian CLI not found";
			} catch {
				return "Obsidian CLI not available";
			}
		},
	},
	{
		id: "vault-note",
		name: "Vault Notes",
		description: "Create and verify vault notes",
		check: () => true,
	},
	{
		id: "vault-structure",
		name: "Vault Structure",
		description: "Verify vault directory structure",
		check: () => true,
	},
	{
		id: "plugin-deploy",
		name: "Plugin Deploy",
		description: "Build and deploy Obsidian plugin artifacts",
		check: () => true,
	},
	{
		id: "plugin-state",
		name: "Plugin State",
		description: "Read and write plugin data.json",
		check: () => true,
	},
	{
		id: "http-check",
		name: "HTTP Check",
		description: "Verify HTTP endpoints",
		check: (deps) => {
			try {
				const result = deps.exec("curl --version", { timeout: 3000 });
				return result.exitCode === 0 ? true : "curl not found";
			} catch {
				return "curl not available";
			}
		},
	},
	{
		id: "dev-server",
		name: "Dev Server",
		description: "Start and stop development servers",
		check: () => true,
	},
	{
		id: "bundle-check",
		name: "Bundle Check",
		description: "Verify build output size and existence",
		check: () => true,
	},
	{
		id: "dom-interaction",
		name: "DOM Interaction",
		description: "Click, evaluate, navigate, and interact with DOM elements via obsidian-cli",
		check: (deps) => {
			try {
				const result = deps.exec("obsidian-cli --version", { timeout: 5000 });
				return result.exitCode === 0 ? true : "Obsidian CLI required for DOM interaction";
			} catch {
				return "Obsidian CLI not available";
			}
		},
	},
	{
		id: "visual",
		name: "Visual Tools",
		description: "Screenshots, highlighting, theme switching via obsidian-cli",
		check: () => true,
	},
	{
		id: "events",
		name: "Event Tools",
		description: "Emit, assert, and query EventBus events via obsidian-cli",
		check: () => true,
	},
	{
		id: "batch",
		name: "Batch Tools",
		description: "Execute multiple assertions in a single obsidian-cli call",
		check: () => true,
	},
	{
		id: "vault-provision",
		name: "Vault Provisioning",
		description: "Provision ephemeral test vaults from a template directory",
		check: () => true,
	},
	{
		id: "vault-cli",
		name: "Vault CLI Execution",
		description: "Execute Flowti CLI commands in a provisioned vault",
		check: () => true,
	},
	{
		id: "vault-project",
		name: "Vault Project Operations",
		description: "Query and manage projects in a provisioned vault",
		check: () => true,
	},
];

// ── Registry factory ─────────────────────────────────────────────────

/**
 * Create the default environment registry with all built-in providers
 * and capabilities pre-registered.
 */
export function createDefaultRegistry(): EnvironmentRegistry {
	const registry = createEnvironmentRegistry();

	// Register capabilities
	for (const cap of builtInCapabilities) {
		registry.registerCapability(cap);
	}

	// Register providers
	registry.registerProvider(createCliProvider());
	registry.registerProvider(createTypescriptProvider());
	registry.registerProvider(createObsidianVaultProvider());
	registry.registerProvider(createObsidianPluginProvider());
	registry.registerProvider(createWebappProvider());
	registry.registerProvider(createVaultTestProvider());

	return registry;
}

export { createCliProvider } from "./cli-provider.js";
export { createTypescriptProvider } from "./typescript-provider.js";
export { createObsidianVaultProvider } from "./obsidian-vault-provider.js";
export { createObsidianPluginProvider } from "./obsidian-plugin-provider.js";
export { createWebappProvider } from "./webapp-provider.js";
export { createVaultTestProvider } from "./vault-test-provider.js";
