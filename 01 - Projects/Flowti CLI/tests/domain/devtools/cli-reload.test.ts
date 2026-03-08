import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockShell } from "../../mocks/mock-shell.js";
import { createMockProc } from "../../mocks/mock-proc.js";

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: {},
}));

import * as shellMod from "../../../src/infrastructure/shell.js";
import * as procMod from "../../../src/infrastructure/proc.js";
import { log, warn } from "../../../src/infrastructure/logger.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const mockWarn = warn as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	// Reset module cache so cli-reload.ts re-runs main()
	vi.resetModules();
});

async function runCliReload(shellOpts: Parameters<typeof createMockShell>[0] = {}, argv: string[] = []) {
	// Re-mock with specific options before importing the module
	const sh = createMockShell(shellOpts);
	Object.assign(shellMod, { shell: sh });

	const p = createMockProc({ argv });
	Object.assign(procMod, { proc: p });

	// Dynamic import to trigger module-level main() execution
	await import("../../../src/domain/devtools/cli-reload.js");

	return { sh, p };
}

describe("cli-reload", () => {
	it("skips reload when CLI is not available", async () => {
		// execFile returns null => CLI not available
		const { sh } = await runCliReload({ outputs: {} });

		// First call is the version check; it returns null (not available)
		expect(sh.calls[0].cmd).toContain("obsidian version");
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("not available"));
	});

	it("reloads plugin when CLI is available", async () => {
		const { sh } = await runCliReload({
			outputs: {
				"obsidian version": "1.12.0",
				"obsidian plugin:reload id=flowti-ibde": "ok",
			},
		});

		// Should call version check then reload
		expect(sh.calls.length).toBeGreaterThanOrEqual(2);
		expect(sh.calls[1].cmd).toContain("plugin:reload");
		expect(sh.calls[1].cmd).toContain("id=flowti-ibde");
		expect(mockLog).toHaveBeenCalledWith(expect.stringContaining("Plugin reloaded"));
	});

	it("passes vault arg when --vault flag is provided", async () => {
		const { sh } = await runCliReload(
			{
				outputs: {
					"obsidian version": "1.12.0",
					"obsidian vault=myVault plugin:reload id=flowti-ibde": "ok",
				},
			},
			["--vault=myVault"],
		);

		expect(sh.calls.length).toBeGreaterThanOrEqual(2);
		expect(sh.calls[1].cmd).toContain("vault=myVault");
	});

	it("warns when reload fails (non-fatal)", async () => {
		// version returns a value (available), but reload returns null (failure)
		const { sh } = await runCliReload({
			outputs: {
				"obsidian version": "1.12.0",
				// reload key not present => returns null
			},
		});

		expect(sh.calls.length).toBeGreaterThanOrEqual(2);
		expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("Reload failed"));
	});

	it("omits vault arg when --vault flag is not present", async () => {
		const { sh } = await runCliReload({
			outputs: {
				"obsidian version": "1.12.0",
				"obsidian plugin:reload id=flowti-ibde": "ok",
			},
		});

		expect(sh.calls[1].cmd).not.toContain("vault=");
	});
});
