import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";
import { reloadPlugin } from "../../../src/domain/devtools/cli-reload.js";

beforeEach(() => {
	vi.clearAllMocks();
});

function makeDeps(sh: ReturnType<typeof createMockShell>): Pick<import("../../../src/infrastructure/deps.js").CliDeps, "warn" | "shell" | "log"> & { shell: ReturnType<typeof createMockShell> } {
	return {
		shell: sh,
		log: vi.fn() as (msg: string) => void,
		warn: vi.fn() as (msg: string) => void,
	};
}

describe("cli-reload", () => {
	it("skips reload when CLI is not available", () => {
		const sh = createMockShell({ outputs: {} });
		const deps = makeDeps(sh);

		const result = reloadPlugin(undefined, deps);

		expect(result).toBe(false);
		expect(sh.calls[0].cmd).toContain("obsidian version");
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("not available"));
	});

	it("reloads plugin when CLI is available", () => {
		const sh = createMockShell({
			outputs: {
				"obsidian version": "1.12.0",
				"obsidian plugin:reload id=flowti-ibde": "ok",
			},
		});
		const deps = makeDeps(sh);

		const result = reloadPlugin(undefined, deps);

		expect(result).toBe(true);
		expect(sh.calls.length).toBeGreaterThanOrEqual(2);
		expect(sh.calls[1].cmd).toContain("plugin:reload");
		expect(sh.calls[1].cmd).toContain("id=flowti-ibde");
		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("Plugin reloaded"));
	});

	it("passes vault arg when vault parameter is provided", () => {
		const sh = createMockShell({
			outputs: {
				"obsidian version": "1.12.0",
				"obsidian vault=myVault plugin:reload id=flowti-ibde": "ok",
			},
		});
		const deps = makeDeps(sh);

		reloadPlugin("myVault", deps);

		expect(sh.calls.length).toBeGreaterThanOrEqual(2);
		expect(sh.calls[1].cmd).toContain("vault=myVault");
	});

	it("warns when reload fails (non-fatal)", () => {
		const sh = createMockShell({
			outputs: {
				"obsidian version": "1.12.0",
			},
		});
		const deps = makeDeps(sh);

		const result = reloadPlugin(undefined, deps);

		expect(result).toBe(false);
		expect(deps.warn).toHaveBeenCalledWith(expect.stringContaining("Reload failed"));
	});

	it("omits vault arg when no vault provided", () => {
		const sh = createMockShell({
			outputs: {
				"obsidian version": "1.12.0",
				"obsidian plugin:reload id=flowti-ibde": "ok",
			},
		});
		const deps = makeDeps(sh);

		reloadPlugin(undefined, deps);

		expect(sh.calls[1].cmd).not.toContain("vault=");
	});
});
