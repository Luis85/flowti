import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import { log, warn } from "../../../src/infrastructure/logger.js";
import { reloadPlugin } from "../../../src/scripts/cli-reload.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const mockWarn = warn as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

function setupShell(opts: Parameters<typeof createMockShell>[0] = {}) {
	const sh = createMockShell(opts);
	Object.assign(shellMod, { shell: sh });
	return sh;
}

describe("cli-reload", () => {
	it("skips reload when CLI is not available", () => {
		const sh = setupShell({ outputs: {} });

		const result = reloadPlugin();

		expect(result).toBe(false);
		expect(sh.calls[0].cmd).toContain("obsidian version");
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("not available"));
	});

	it("reloads plugin when CLI is available", () => {
		const sh = setupShell({
			outputs: {
				"obsidian version": "1.12.0",
				"obsidian plugin:reload id=flowti-ibde": "ok",
			},
		});

		const result = reloadPlugin();

		expect(result).toBe(true);
		expect(sh.calls.length).toBeGreaterThanOrEqual(2);
		expect(sh.calls[1].cmd).toContain("plugin:reload");
		expect(sh.calls[1].cmd).toContain("id=flowti-ibde");
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("Plugin reloaded"));
	});

	it("passes vault arg when vault parameter is provided", () => {
		const sh = setupShell({
			outputs: {
				"obsidian version": "1.12.0",
				"obsidian vault=myVault plugin:reload id=flowti-ibde": "ok",
			},
		});

		reloadPlugin("myVault");

		expect(sh.calls.length).toBeGreaterThanOrEqual(2);
		expect(sh.calls[1].cmd).toContain("vault=myVault");
	});

	it("warns when reload fails (non-fatal)", () => {
		setupShell({
			outputs: {
				"obsidian version": "1.12.0",
			},
		});

		const result = reloadPlugin();

		expect(result).toBe(false);
		expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("Reload failed"));
	});

	it("omits vault arg when no vault provided", () => {
		const sh = setupShell({
			outputs: {
				"obsidian version": "1.12.0",
				"obsidian plugin:reload id=flowti-ibde": "ok",
			},
		});

		reloadPlugin();

		expect(sh.calls[1].cmd).not.toContain("vault=");
	});
});
