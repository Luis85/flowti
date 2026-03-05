import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandRegistry } from "../../../src/infrastructure/commands/CommandRegistry";
import type { CommandDefinition, CommandMeta } from "../../../src/infrastructure/commands/types";
import { createCommandDefinitions, getExternalCommandMeta, registerCommands } from "../../../src/infrastructure/commands/registry";

describe("CommandRegistry — metadata", () => {
	let registry: CommandRegistry;

	beforeEach(() => {
		registry = new CommandRegistry();
	});

	describe("CommandMeta fields on CommandDefinition", () => {
		it("should accept optional description, domain, and category", () => {
			const cmd: CommandDefinition = {
				id: "test:meta",
				name: "Test",
				description: "A test command",
				domain: "hub",
				category: "view",
				handler: vi.fn(),
			};

			registry.register(cmd);
			const retrieved = registry.getCommand("test:meta");
			expect(retrieved?.description).toBe("A test command");
			expect(retrieved?.domain).toBe("hub");
			expect(retrieved?.category).toBe("view");
		});

		it("should remain backward-compatible without meta fields", () => {
			const cmd: CommandDefinition = {
				id: "test:no-meta",
				name: "No Meta",
				handler: vi.fn(),
			};

			registry.register(cmd);
			expect(registry.getCommand("test:no-meta")).toBeDefined();
		});
	});

	describe("registerMeta", () => {
		it("should register metadata for external commands", () => {
			const meta: CommandMeta = {
				id: "ext:cmd",
				label: "External Command",
				description: "Registered outside the registry",
				domain: "session",
				category: "action",
			};

			registry.registerMeta(meta);

			const all = registry.getCommandsMeta();
			expect(all).toHaveLength(1);
			expect(all[0]).toEqual(meta);
		});

		it("should skip duplicate meta registration silently", () => {
			const meta: CommandMeta = {
				id: "ext:dup",
				label: "Dup",
				description: "Duplicate",
				domain: "hub",
				category: "view",
			};

			registry.registerMeta(meta);
			registry.registerMeta(meta);

			expect(registry.getCommandsMeta()).toHaveLength(1);
		});

		it("should skip meta registration if command ID already registered", () => {
			registry.register({
				id: "test:existing",
				name: "Existing",
				description: "Already here",
				domain: "hub",
				category: "view",
				handler: vi.fn(),
			});

			registry.registerMeta({
				id: "test:existing",
				label: "Existing Meta",
				description: "Should be skipped",
				domain: "hub",
				category: "view",
			});

			const all = registry.getCommandsMeta();
			expect(all).toHaveLength(1);
			expect(all[0].label).toBe("Existing");
		});
	});

	describe("getCommandsMeta", () => {
		it("should return empty array for empty registry", () => {
			expect(registry.getCommandsMeta()).toEqual([]);
		});

		it("should project CommandDefinition with meta into CommandMeta", () => {
			registry.register({
				id: "test:projected",
				name: "Projected Command",
				description: "A projected command",
				domain: "capture",
				category: "capture",
				icon: "pencil",
				handler: vi.fn(),
			});

			const meta = registry.getCommandsMeta();
			expect(meta).toHaveLength(1);
			expect(meta[0]).toEqual({
				id: "test:projected",
				label: "Projected Command",
				description: "A projected command",
				domain: "capture",
				category: "capture",
				icon: "pencil",
				shortcut: undefined,
			});
		});

		it("should exclude commands without complete metadata", () => {
			registry.register({
				id: "test:incomplete",
				name: "Incomplete",
				handler: vi.fn(),
			});

			expect(registry.getCommandsMeta()).toHaveLength(0);
		});

		it("should format hotkey as shortcut string", () => {
			registry.register({
				id: "test:hotkey",
				name: "Hotkey Cmd",
				description: "Has hotkey",
				domain: "hub",
				category: "view",
				hotkeys: [{ modifiers: ["Mod", "Shift"], key: "P" }],
				handler: vi.fn(),
			});

			const meta = registry.getCommandsMeta();
			expect(meta[0].shortcut).toBe("Mod+Shift+P");
		});

		it("should combine registry commands and meta-only entries", () => {
			registry.register({
				id: "reg:cmd",
				name: "Reg Cmd",
				description: "Registry command",
				domain: "hub",
				category: "view",
				handler: vi.fn(),
			});

			registry.registerMeta({
				id: "ext:cmd",
				label: "Ext Cmd",
				description: "External command",
				domain: "session",
				category: "action",
			});

			const all = registry.getCommandsMeta();
			expect(all).toHaveLength(2);
			expect(all.map((m) => m.id)).toContain("reg:cmd");
			expect(all.map((m) => m.id)).toContain("ext:cmd");
		});
	});

	describe("getCommandsByDomain", () => {
		it("should return empty map for empty registry", () => {
			const grouped = registry.getCommandsByDomain();
			expect(grouped.size).toBe(0);
		});

		it("should group commands by domain", () => {
			registry.register({
				id: "hub:one",
				name: "Hub One",
				description: "First hub command",
				domain: "hub",
				category: "view",
				handler: vi.fn(),
			});
			registry.register({
				id: "hub:two",
				name: "Hub Two",
				description: "Second hub command",
				domain: "hub",
				category: "view",
				handler: vi.fn(),
			});
			registry.register({
				id: "capture:one",
				name: "Capture One",
				description: "Capture command",
				domain: "capture",
				category: "capture",
				handler: vi.fn(),
			});

			const grouped = registry.getCommandsByDomain();
			expect(grouped.size).toBe(2);
			expect(grouped.get("hub")).toHaveLength(2);
			expect(grouped.get("capture")).toHaveLength(1);
		});

		it("should include meta-only entries in domain groups", () => {
			registry.registerMeta({
				id: "ext:session",
				label: "Session Cmd",
				description: "A session command",
				domain: "session",
				category: "action",
			});

			const grouped = registry.getCommandsByDomain();
			expect(grouped.get("session")).toHaveLength(1);
			expect(grouped.get("session")![0].id).toBe("ext:session");
		});
	});

	describe("clear", () => {
		it("should clear meta-only entries too", () => {
			registry.registerMeta({
				id: "ext:clear",
				label: "Clear Me",
				description: "Should be cleared",
				domain: "hub",
				category: "view",
			});

			registry.clear();
			expect(registry.getCommandsMeta()).toHaveLength(0);
		});
	});

	describe("createCommandDefinitions — metadata completeness", () => {
		it("should annotate all registry commands with description", () => {
			const defs = createCommandDefinitions();
			for (const cmd of defs) {
				expect(cmd.description, `${cmd.id} missing description`).toBeTruthy();
			}
		});

		it("should annotate all registry commands with domain", () => {
			const defs = createCommandDefinitions();
			for (const cmd of defs) {
				expect(cmd.domain, `${cmd.id} missing domain`).toBeTruthy();
			}
		});

		it("should annotate all registry commands with category", () => {
			const defs = createCommandDefinitions();
			for (const cmd of defs) {
				expect(cmd.category, `${cmd.id} missing category`).toBeTruthy();
			}
		});
	});

	describe("getExternalCommandMeta — metadata completeness", () => {
		it("should provide metadata for all external commands", () => {
			const meta = getExternalCommandMeta();
			expect(meta.length).toBe(11);
		});

		it("should have complete metadata for every external command", () => {
			const meta = getExternalCommandMeta();
			for (const m of meta) {
				expect(m.id, `missing id`).toBeTruthy();
				expect(m.label, `${m.id} missing label`).toBeTruthy();
				expect(m.description, `${m.id} missing description`).toBeTruthy();
				expect(m.domain, `${m.id} missing domain`).toBeTruthy();
				expect(m.category, `${m.id} missing category`).toBeTruthy();
			}
		});
	});

	describe("registerCommands — full catalog", () => {
		it("should register all 39 commands as queryable metadata", () => {
			registerCommands(registry);

			const all = registry.getCommandsMeta();
			expect(all.length).toBe(39);
		});

		it("should cover all expected domains", () => {
			registerCommands(registry);

			const grouped = registry.getCommandsByDomain();
			expect(grouped.has("hub")).toBe(true);
			expect(grouped.has("capture")).toBe(true);
			expect(grouped.has("train")).toBe(true);
			expect(grouped.has("data-exchange")).toBe(true);
			expect(grouped.has("session")).toBe(true);
			expect(grouped.has("subscription")).toBe(true);
			expect(grouped.has("analytics")).toBe(true);
			expect(grouped.has("developer")).toBe(true);
		});

		it("should have no duplicate command IDs across registry and meta", () => {
			registerCommands(registry);

			const all = registry.getCommandsMeta();
			const ids = all.map((m) => m.id);
			const unique = new Set(ids);
			expect(ids.length).toBe(unique.size);
		});
	});
});
