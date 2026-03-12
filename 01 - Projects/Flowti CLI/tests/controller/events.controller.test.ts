/**
 * events.controller.test.ts — Tests for the events controller.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));
vi.mock("../../src/infrastructure/paths.js", () => ({
	paths: {
		join: vi.fn((...args: string[]) => args.join("/")),
		resolve: vi.fn((...args: string[]) => args.join("/")),
		relative: vi.fn((_a: string, b: string) => b),
		dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/")),
		basename: vi.fn((p: string) => p.split("/").pop() ?? p),
		isAbsolute: vi.fn(() => true),
	},
}));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn(), warn: vi.fn() }));
vi.mock("../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(() => null), check: vi.fn(() => true), runCapture: vi.fn(() => ""), execFile: vi.fn(() => null), runCaptureStatus: vi.fn(() => ({ output: "", exitCode: 0 })), runCaptureDetailed: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })), spawnBackground: vi.fn(() => ({ running: false, output: [], onOutput: () => () => {}, kill: () => {}, waitForOutput: () => Promise.resolve(null) })), runAsync: vi.fn(async () => ({ output: "", exitCode: 0 })), runParallel: vi.fn(async () => []) },
}));
vi.mock("../../src/infrastructure/clock.js", () => ({
	clock: { now: () => new Date(), iso: () => "", ms: () => 0, safeIso: () => "" },
}));
vi.mock("../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => ""), askYesNo: vi.fn(async () => false), waitForEnter: vi.fn(async () => {}) },
}));
vi.mock("../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn(), argv: () => [], cwd: () => "/", env: () => ({}) },
}));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));
vi.mock("../../src/ui/cli-event-renderer.js", () => ({ attachCliRenderer: vi.fn(() => () => {}) }));
vi.mock("../../src/infrastructure/request-response.js", async () => {
	const actual = await vi.importActual<typeof import("../../src/infrastructure/request-response.js")>("../../src/infrastructure/request-response.js");
	return actual;
});
vi.mock("../../src/domain/events/event-catalog.js", () => ({
	listEvents: vi.fn(() => [
		{ name: "user.created", domain: "user", version: "1.0.0" },
		{ name: "order.placed", domain: "order", version: "1.0.0" },
	]),
	createEventFile: vi.fn(() => "/project/docs/events/user.created.json"),
	parseCommaSeparated: vi.fn((s: string) => s.split(",").map((x: string) => x.trim()).filter(Boolean)),
}));
vi.mock("../../src/domain/events/event-payload.js", () => ({
	parsePayloadFlag: vi.fn(() => [{ name: "id", type: "string", required: true }]),
}));
vi.mock("../../src/domain/events/event-versioning.js", () => ({
	versionEvent: vi.fn(() => ({ success: true, name: "user.created", newVersion: "2.0.0", previousVersion: "1.0.0" })),
}));
vi.mock("../../src/domain/events/event-flow.js", () => ({
	saveEventFlowDoc: vi.fn(() => "/project/docs/events/flow.md"),
}));
vi.mock("../../src/domain/events/event-contracts.js", () => ({
	loadEventContracts: vi.fn(() => [
		{ name: "user.created", domain: "user", version: "1.0.0", payload: [{ name: "id", type: "string", required: true }] },
	]),
	validateContracts: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
	generateContractsJson: vi.fn(() => '{"contracts":[]}'),
	validatePayload: vi.fn(() => ({ valid: true, errors: [] })),
	findContract: vi.fn(() => ({ name: "user.created", payload: [{ name: "id", type: "string", required: true }] })),
}));
vi.mock("../../src/domain/events/event-codegen.js", () => ({
	generateEventTypes: vi.fn(() => "export type Events = {};"),
}));
vi.mock("../../src/ui/events-display.js", () => ({
	renderEventList: vi.fn(),
	renderEventFlowCreated: vi.fn(),
	renderEventAdded: vi.fn(),
	renderContractValidation: vi.fn(),
	renderPayloadValidation: vi.fn(),
	renderContractsGenerated: vi.fn(),
	renderCodegenGenerated: vi.fn(),
	renderEmpty: vi.fn(),
	renderVersionEvent: vi.fn(),
}));
vi.mock("../../src/ui/common-renderers.js", () => ({
	renderError: vi.fn(),
}));

import { commands } from "../../src/controller/events.controller.js";
import { listEvents, createEventFile } from "../../src/domain/events/event-catalog.js";
import { loadEventContracts, validateContracts } from "../../src/domain/events/event-contracts.js";

const mockProject = {
	path: "/project",
	pkg: { name: "test", version: "1.0.0" },
	config: { name: "test", reports: { generators: [] }, health: {} },
	scripts: {},
};

describe("events.controller", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ── events:list ───────────────────────────────────────────────
	describe("events:list", () => {
		it("returns event list from the project", () => {
			commands["events:list"]({}, [], "events:list", mockProject);
			expect(listEvents).toHaveBeenCalledWith(expect.any(Object), "/project");
		});

		it("returns undefined when no project", () => {
			commands["events:list"]({}, [], "events:list", undefined);
			expect(listEvents).not.toHaveBeenCalled();
		});
	});

	// ── events:add ────────────────────────────────────────────────
	describe("events:add", () => {
		it("creates event file with provided flags", () => {
			commands["events:add"](
				{ name: "user.created", domain: "user", version: "1.0.0", description: "User was created" },
				[], "events:add", mockProject,
			);
			expect(createEventFile).toHaveBeenCalledWith(expect.any(Object), "/project", expect.objectContaining({
				name: "user.created",
				domain: "user",
			}));
		});

		it("returns error when --name flag is missing", () => {
			commands["events:add"]({}, [], "events:add", mockProject);
			expect(createEventFile).not.toHaveBeenCalled();
		});

		it("returns undefined when no project", () => {
			commands["events:add"]({ name: "x" }, [], "events:add", undefined);
			expect(createEventFile).not.toHaveBeenCalled();
		});
	});

	// ── events:validate ───────────────────────────────────────────
	describe("events:validate", () => {
		it("returns validation result for contracts", () => {
			commands["events:validate"]({}, [], "events:validate", mockProject);
			expect(loadEventContracts).toHaveBeenCalled();
			expect(validateContracts).toHaveBeenCalled();
		});

		it("returns empty message when no contracts found", () => {
			vi.mocked(loadEventContracts).mockReturnValue([]);
			commands["events:validate"]({}, [], "events:validate", mockProject);
			expect(validateContracts).not.toHaveBeenCalled();
		});

		it("returns undefined when no project", () => {
			commands["events:validate"]({}, [], "events:validate", undefined);
			expect(loadEventContracts).not.toHaveBeenCalled();
		});
	});

	// ── events:version ────────────────────────────────────────────
	describe("events:version", () => {
		it("returns error when required flags are missing", () => {
			commands["events:version"]({}, [], "events:version", mockProject);
			// No versionEvent call expected — error response returned
		});

		it("calls versionEvent with correct arguments", async () => {
			const { versionEvent } = await import("../../src/domain/events/event-versioning.js");
			commands["events:version"](
				{ name: "user.created", version: "2.0.0", migration: "Added email" },
				[], "events:version", mockProject,
			);
			expect(versionEvent).toHaveBeenCalledWith(expect.any(Object), "/project", "user.created", "2.0.0", "Added email");
		});
	});
});
