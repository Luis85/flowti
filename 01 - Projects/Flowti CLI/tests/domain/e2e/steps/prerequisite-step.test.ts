import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/domain/e2e/e2e-prerequisites.js", () => ({
	checkPrerequisites: vi.fn(() => ({
		vaultExists: true,
		artifactsPresent: true,
		missingArtifacts: [],
		cliResponsive: true,
		vaultInstalled: true,
		testDataPresent: true,
	})),
	validatePrerequisites: vi.fn(),
}));
import {
	checkPrerequisites,
	validatePrerequisites,
} from "../../../../src/domain/e2e/e2e-prerequisites.js";
import { createPrerequisiteStep } from "../../../../src/domain/e2e/steps/prerequisite-step.js";
import type { E2EPaths } from "../../../../src/domain/e2e/e2e-paths.js";
import type { E2ERenderer } from "../../../../src/domain/e2e/e2e-renderer.js";
import { nullRenderer } from "../../../../src/domain/e2e/e2e-renderer.js";
import type { PipelineContext } from "../../../../src/infrastructure/pipeline/pipeline-types.js";

function createMockRenderer(): E2ERenderer & { prerequisites: ReturnType<typeof vi.fn> } {
	return { ...nullRenderer, prerequisites: vi.fn() };
}

const fakeE2e: E2EPaths = {
	projectRoot: "/dev/flowti",
	pluginId: "flowti-ibde",
	journeysDir: "/dev/flowti/tests/e2e/journeys",
	testVault: "/e2e-vault",
	vaultName: "flowti-e2e",
	pluginDir: "/e2e-vault/.obsidian/plugins/flowti-ibde",
	pluginArtifacts: ["main.js", "manifest.json", "styles.css"],
	dataJsonPath: "/e2e-vault/.obsidian/plugins/flowti-ibde/data.json",
	review: {} as E2EPaths["review"],
} as E2EPaths;

function createMockContext(): PipelineContext {
	const stepData = new Map<string, Record<string, unknown>>();
	return {
		projectPath: "/project",
		pushResult: vi.fn(),
		getResults: vi.fn(() => []),
		getStepResult: vi.fn(),
		setCommandOutput: vi.fn(),
		getCommandOutput: vi.fn(),
		log: vi.fn(),
		setStepData: vi.fn((id, data) => stepData.set(id, data)),
		getStepData: vi.fn((id) => stepData.get(id)),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createPrerequisiteStep", () => {
	it("returns a step with correct id and label", () => {
		const step = createPrerequisiteStep(fakeE2e);

		expect(step.id).toBe("e2e:prerequisites");
		expect(step.label).toBe("Prerequisites");
	});

	it("has an execute function", () => {
		const step = createPrerequisiteStep(fakeE2e);

		expect(typeof step.execute).toBe("function");
	});

	it("calls checkPrerequisites with e2e paths", () => {
		const step = createPrerequisiteStep(fakeE2e);
		const ctx = createMockContext();

		step.execute(ctx);

		expect(checkPrerequisites).toHaveBeenCalledWith(fakeE2e);
	});

	it("calls renderer.prerequisites with results and e2e paths", () => {
		const renderer = createMockRenderer();
		const step = createPrerequisiteStep(fakeE2e, renderer);
		const ctx = createMockContext();

		step.execute(ctx);

		expect(renderer.prerequisites).toHaveBeenCalledWith(
			expect.objectContaining({ vaultExists: true }),
			fakeE2e,
		);
	});

	it("calls validatePrerequisites with check results", () => {
		const step = createPrerequisiteStep(fakeE2e);
		const ctx = createMockContext();

		step.execute(ctx);

		expect(validatePrerequisites).toHaveBeenCalledWith(
			expect.objectContaining({ vaultExists: true }),
		);
	});

	it("stores results in step data", () => {
		const step = createPrerequisiteStep(fakeE2e);
		const ctx = createMockContext();

		step.execute(ctx);

		expect(ctx.setStepData).toHaveBeenCalledWith("e2e:prerequisites", {
			results: expect.objectContaining({ vaultExists: true }),
		});
	});

	it("returns success with data when all prerequisites pass", () => {
		const step = createPrerequisiteStep(fakeE2e);
		const ctx = createMockContext();

		const output = step.execute(ctx);

		expect(output).toEqual({
			success: true,
			data: { results: expect.objectContaining({ vaultExists: true }) },
			warnings: undefined,
		});
	});

	it("includes warning when vault not installed", () => {
		vi.mocked(checkPrerequisites).mockReturnValue({
			vaultExists: true,
			artifactsPresent: true,
			missingArtifacts: [],
			cliResponsive: true,
			vaultInstalled: false,
			testDataPresent: true,
		});
		const step = createPrerequisiteStep(fakeE2e);
		const ctx = createMockContext();

		const output = step.execute(ctx);

		expect(output).toHaveProperty("warnings");
		const warnings = (output as { warnings: string[] }).warnings;
		expect(warnings).toContain("Vault not installed \u2014 installer will run");
	});

	it("includes warning when test data missing", () => {
		vi.mocked(checkPrerequisites).mockReturnValue({
			vaultExists: true,
			artifactsPresent: true,
			missingArtifacts: [],
			cliResponsive: true,
			vaultInstalled: true,
			testDataPresent: false,
		});
		const step = createPrerequisiteStep(fakeE2e);
		const ctx = createMockContext();

		const output = step.execute(ctx);

		expect(output).toHaveProperty("warnings");
		const warnings = (output as { warnings: string[] }).warnings;
		expect(warnings).toContain("Test data missing \u2014 will be generated during setup");
	});

	it("includes both warnings when both conditions fail", () => {
		vi.mocked(checkPrerequisites).mockReturnValue({
			vaultExists: true,
			artifactsPresent: true,
			missingArtifacts: [],
			cliResponsive: true,
			vaultInstalled: false,
			testDataPresent: false,
		});
		const step = createPrerequisiteStep(fakeE2e);
		const ctx = createMockContext();

		const output = step.execute(ctx);

		const warnings = (output as { warnings: string[] }).warnings;
		expect(warnings).toHaveLength(2);
	});

	it("propagates error when validatePrerequisites throws", () => {
		vi.mocked(validatePrerequisites).mockImplementation(() => {
			throw new Error("Vault not found");
		});
		const step = createPrerequisiteStep(fakeE2e);
		const ctx = createMockContext();

		expect(() => step.execute(ctx)).toThrow("Vault not found");
	});
});
