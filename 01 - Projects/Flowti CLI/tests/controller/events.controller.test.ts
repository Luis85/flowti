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
vi.mock("../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../mocks/mock-presets.js");
	return mockShellPreset();
});
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
vi.mock("../../src/ui/renderers/cli-event-renderer.js", () => ({ attachCliRenderer: vi.fn(() => () => {}) }));
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
vi.mock("../../src/ui/displays/events-display.js", () => ({
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
vi.mock("../../src/ui/renderers/common-renderers.js", () => ({
	renderError: vi.fn(),
	renderNoProject: vi.fn(),
}));

import { commands } from "../../src/controller/events.controller.js";
import { listEvents, createEventFile } from "../../src/domain/events/event-catalog.js";
import { loadEventContracts, validateContracts, findContract, validatePayload, generateContractsJson } from "../../src/domain/events/event-contracts.js";
import { saveEventFlowDoc } from "../../src/domain/events/event-flow.js";
import { generateEventTypes } from "../../src/domain/events/event-codegen.js";
import { disk } from "../../src/infrastructure/filesystem.js";
import { log } from "../../src/infrastructure/logger.js";
import { proc } from "../../src/infrastructure/proc.js";
import { renderEventFlowCreated, renderContractsGenerated, renderCodegenGenerated } from "../../src/ui/displays/events-display.js";

const mockProject = {
	path: "/project",
	pkg: { name: "test", version: "1.0.0" },
	config: { name: "test", reports: { generators: [] }, health: {} },
	scripts: {},
};

describe("events.controller", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		// Re-apply factory mocks cleared by restoreAllMocks
		vi.mocked(listEvents).mockReturnValue([
			{ name: "user.created", domain: "user", version: "1.0.0" },
			{ name: "order.placed", domain: "order", version: "1.0.0" },
		] as ReturnType<typeof listEvents>);
		vi.mocked(createEventFile).mockReturnValue("/project/docs/events/user.created.json");
		vi.mocked(loadEventContracts).mockReturnValue([
			{ name: "user.created", domain: "user", version: "1.0.0", description: "", producers: [], consumers: [], payload: [{ field: "id", type: "string", required: true, description: "" }] },
		] as ReturnType<typeof loadEventContracts>);
		vi.mocked(validateContracts).mockReturnValue({ valid: true, issues: [] });
		vi.mocked(generateContractsJson).mockReturnValue('{"contracts":[]}');
		vi.mocked(validatePayload).mockReturnValue({ valid: true, errors: [] });
		vi.mocked(findContract).mockReturnValue({ name: "user.created", domain: "user", version: "1.0.0", description: "", producers: [], consumers: [], payload: [{ field: "id", type: "string", required: true, description: "" }] } as ReturnType<typeof findContract>);
		vi.mocked(generateEventTypes).mockReturnValue("export type Events = {};");
		vi.mocked(saveEventFlowDoc).mockReturnValue("/project/docs/events/flow.md");
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
			vi.mocked(loadEventContracts).mockReturnValueOnce([]);
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

	// ── events:flow ───────────────────────────────────────────────
	describe("events:flow", () => {
		it("calls saveEventFlowDoc and returns relativePath data", () => {
			commands["events:flow"]({ format: "json" }, [], "events:flow", mockProject);
			expect(saveEventFlowDoc).toHaveBeenCalledWith(expect.any(Object), "/project", undefined);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual({ relativePath: "/project/docs/events/flow.md" });
		});

		it("passes domain flag when provided", () => {
			commands["events:flow"]({ domain: "user" }, [], "events:flow", mockProject);
			expect(saveEventFlowDoc).toHaveBeenCalledWith(expect.any(Object), "/project", "user");
		});

		it("coerces boolean domain flag to string", () => {
			commands["events:flow"]({ domain: true }, [], "events:flow", mockProject);
			// adaptDescriptor coerces boolean flags to strings; "true" is truthy so it passes through
			expect(saveEventFlowDoc).toHaveBeenCalledWith(expect.any(Object), "/project", "true");
		});

		it("returns undefined when no project", () => {
			commands["events:flow"]({}, [], "events:flow", undefined);
			expect(saveEventFlowDoc).not.toHaveBeenCalled();
		});

		it("calls renderer in default format", () => {
			commands["events:flow"]({}, [], "events:flow", mockProject);
			expect(renderEventFlowCreated).toHaveBeenCalled();
		});
	});

	// ── events:check-payload ─────────────────────────────────────
	describe("events:check-payload", () => {
		it("returns error when --event flag is missing", () => {
			commands["events:check-payload"]({ payload: '{"id":"1"}', format: "json" }, [], "events:check-payload", mockProject);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual(expect.objectContaining({ error: expect.stringContaining("Missing") }));
		});

		it("returns error when --payload flag is missing", () => {
			commands["events:check-payload"]({ event: "user.created", format: "json" }, [], "events:check-payload", mockProject);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual(expect.objectContaining({ error: expect.stringContaining("Missing") }));
		});

		it("returns error when both flags are missing", () => {
			commands["events:check-payload"]({ format: "json" }, [], "events:check-payload", mockProject);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual(expect.objectContaining({ error: expect.stringContaining("Missing") }));
		});

		it("returns error when contract is not found", () => {
			vi.mocked(findContract).mockReturnValueOnce(undefined);
			commands["events:check-payload"](
				{ event: "unknown.event", payload: '{"id":"1"}', format: "json" },
				[], "events:check-payload", mockProject,
			);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual(expect.objectContaining({ error: expect.stringContaining("No contract found") }));
			expect(proc.exit).toHaveBeenCalledWith(1);
		});

		it("returns error when payload is invalid JSON", () => {
			commands["events:check-payload"](
				{ event: "user.created", payload: "not-json", format: "json" },
				[], "events:check-payload", mockProject,
			);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual(expect.objectContaining({ error: "Invalid JSON payload." }));
			expect(proc.exit).toHaveBeenCalledWith(1);
		});

		it("validates payload against contract on happy path", () => {
			commands["events:check-payload"](
				{ event: "user.created", payload: '{"id":"1"}', format: "json" },
				[], "events:check-payload", mockProject,
			);
			expect(loadEventContracts).toHaveBeenCalled();
			expect(findContract).toHaveBeenCalled();
			expect(validatePayload).toHaveBeenCalled();
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual({ eventName: "user.created", result: { valid: true, errors: [] } });
		});

		it("exits with code 1 when validation fails", () => {
			vi.mocked(validatePayload).mockReturnValueOnce({ valid: false, errors: ["missing field: id"] });
			commands["events:check-payload"](
				{ event: "user.created", payload: '{"foo":"bar"}', format: "json" },
				[], "events:check-payload", mockProject,
			);
			expect(proc.exit).toHaveBeenCalledWith(1);
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual({ eventName: "user.created", result: { valid: false, errors: ["missing field: id"] } });
		});

		it("does not exit when validation passes", () => {
			commands["events:check-payload"](
				{ event: "user.created", payload: '{"id":"1"}' },
				[], "events:check-payload", mockProject,
			);
			expect(proc.exit).not.toHaveBeenCalled();
		});

		it("does nothing when no project", () => {
			commands["events:check-payload"](
				{ event: "user.created", payload: '{"id":"1"}' },
				[], "events:check-payload", undefined,
			);
			expect(loadEventContracts).not.toHaveBeenCalled();
		});
	});

	// ── events:contracts ─────────────────────────────────────────
	describe("events:contracts", () => {
		it("generates contracts JSON and writes to default path", () => {
			commands["events:contracts"]({ format: "json" }, [], "events:contracts", mockProject);
			expect(loadEventContracts).toHaveBeenCalled();
			expect(generateContractsJson).toHaveBeenCalled();
			expect(disk.mkdirSync).toHaveBeenCalled();
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/project/docs/events/contracts.json",
				'{"contracts":[]}',
				"utf-8",
			);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual({
				relativePath: "/project/docs/events/contracts.json",
				contractCount: 1,
			});
		});

		it("uses custom --out path when provided", () => {
			commands["events:contracts"]({ out: "custom/out.json" }, [], "events:contracts", mockProject);
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/project/custom/out.json",
				'{"contracts":[]}',
				"utf-8",
			);
		});

		it("returns empty message when no contracts found", () => {
			vi.mocked(loadEventContracts).mockReturnValueOnce([]);
			commands["events:contracts"]({ format: "json" }, [], "events:contracts", mockProject);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual({ message: "No events found in docs/events/." });
			expect(generateContractsJson).not.toHaveBeenCalled();
		});

		it("does nothing when no project", () => {
			commands["events:contracts"]({}, [], "events:contracts", undefined);
			expect(loadEventContracts).not.toHaveBeenCalled();
		});

		it("calls renderer in default format", () => {
			commands["events:contracts"]({}, [], "events:contracts", mockProject);
			expect(renderContractsGenerated).toHaveBeenCalled();
		});
	});

	// ── events:codegen ───────────────────────────────────────────
	describe("events:codegen", () => {
		it("generates TypeScript types and writes to default path", () => {
			commands["events:codegen"]({ format: "json" }, [], "events:codegen", mockProject);
			expect(loadEventContracts).toHaveBeenCalled();
			expect(generateEventTypes).toHaveBeenCalled();
			expect(disk.mkdirSync).toHaveBeenCalled();
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/project/src/generated/event-types.ts",
				"export type Events = {};",
				"utf-8",
			);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual({
				relativePath: "/project/src/generated/event-types.ts",
				contractCount: 1,
			});
		});

		it("uses custom --out path when provided", () => {
			commands["events:codegen"]({ out: "custom/types.ts" }, [], "events:codegen", mockProject);
			expect(disk.writeFileSync).toHaveBeenCalledWith(
				"/project/custom/types.ts",
				"export type Events = {};",
				"utf-8",
			);
		});

		it("returns empty message when no contracts found", () => {
			vi.mocked(loadEventContracts).mockReturnValueOnce([]);
			commands["events:codegen"]({ format: "json" }, [], "events:codegen", mockProject);
			expect(log).toHaveBeenCalledOnce();
			const output = JSON.parse(vi.mocked(log).mock.calls[0][0] as string);
			expect(output).toEqual({ message: "No events found in docs/events/." });
			expect(generateEventTypes).not.toHaveBeenCalled();
		});

		it("does nothing when no project", () => {
			commands["events:codegen"]({}, [], "events:codegen", undefined);
			expect(loadEventContracts).not.toHaveBeenCalled();
		});

		it("creates output directory recursively", () => {
			commands["events:codegen"]({}, [], "events:codegen", mockProject);
			expect(disk.mkdirSync).toHaveBeenCalledWith(
				"/project/src/generated",
				{ recursive: true },
			);
		});

		it("calls renderer in default format", () => {
			commands["events:codegen"]({}, [], "events:codegen", mockProject);
			expect(renderCodegenGenerated).toHaveBeenCalled();
		});
	});
});
