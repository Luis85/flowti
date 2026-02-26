import { describe, it, expect, vi } from "vitest";
import { SeedContentStep } from "../../../../src/domain/installer/steps/SeedContentStep";
import { SEED_CSV_PATH, SESSION_TEMPLATE_PATHS, SUPPLIER_OVERVIEW_CSV, WELCOME_NOTE_PATH } from "../../../../src/domain/installer/seedData";
import type {
	InstallerContext,
	InstallerStepDeps,
} from "../../../../src/domain/installer/types";

function createMockDeps(): InstallerStepDeps {
	return {
		fileSystem: {
			fileExists: vi.fn(),
			createFile: vi.fn(),
			readFile: vi.fn(),
			updateFile: vi.fn(),
			deleteFile: vi.fn(),
			moveFile: vi.fn(),
			renameFile: vi.fn(),
			getFrontmatter: vi.fn(),
			updateFrontmatter: vi.fn(),
			setFrontmatter: vi.fn(),
		},
		eventBus: {
			on: vi.fn(() => vi.fn()),
			once: vi.fn(() => vi.fn()),
			emit: vi.fn(),
			clear: vi.fn(),
		} as never,
		userService: {
			load: vi.fn(),
			hasUser: vi.fn(() => false),
			getUser: vi.fn(() => null),
			createUser: vi.fn(),
			updateUserName: vi.fn(),
		},
	};
}

describe("SeedContentStep", () => {
	const step = new SeedContentStep();

	it("should have correct metadata", () => {
		expect(step.id).toBe("seed-content");
		expect(step.name).toBe("Seed Sample Data");
		expect(step.order).toBe(30);
		expect(step.intro).toContain("supplier");
	});

	it("should create supplier CSV and welcome note", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice" };

		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(deps.fileSystem.createFile).toHaveBeenCalledTimes(2);
	});

	it("should write CSV to the correct path", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice" };

		await step.execute(context, deps);

		expect(deps.fileSystem.createFile).toHaveBeenCalledWith(
			SEED_CSV_PATH,
			SUPPLIER_OVERVIEW_CSV,
			{ createFolders: true },
		);
	});

	it("should write welcome note to the correct path", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice" };

		await step.execute(context, deps);

		const calls = vi.mocked(deps.fileSystem.createFile).mock.calls;
		const welcomeCall = calls.find((c) => c[0] === WELCOME_NOTE_PATH);
		expect(welcomeCall).toBeDefined();
		expect(welcomeCall![2]).toEqual({ createFolders: true });
	});

	it("should include user name in welcome note", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Bob" };

		await step.execute(context, deps);

		const calls = vi.mocked(deps.fileSystem.createFile).mock.calls;
		const welcomeCall = calls.find((c) => c[0] === WELCOME_NOTE_PATH);
		expect(welcomeCall![1]).toContain("Welcome to Flowti, Bob!");
	});

	it("should use fallback name when userName is missing", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = {};

		await step.execute(context, deps);

		const calls = vi.mocked(deps.fileSystem.createFile).mock.calls;
		const welcomeCall = calls.find((c) => c[0] === WELCOME_NOTE_PATH);
		expect(welcomeCall![1]).toContain("Welcome to Flowti, there!");
	});

	it("should use createFolders: true for all files", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = {};

		await step.execute(context, deps);

		const calls = vi.mocked(deps.fileSystem.createFile).mock.calls;
		for (const call of calls) {
			expect(call[2]).toEqual({ createFolders: true });
		}
	});

	it("should skip existing files via fileExists check (idempotent)", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.fileSystem.fileExists).mockResolvedValue(true);

		const context: InstallerContext = {};
		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(deps.fileSystem.createFile).not.toHaveBeenCalled();
		expect(context.seededFiles).toHaveLength(2);
	});

	it("should skip only the first file when it already exists", async () => {
		const deps = createMockDeps();
		let callCount = 0;
		vi.mocked(deps.fileSystem.fileExists).mockImplementation(async () => {
			callCount++;
			return callCount === 1; // First file exists, second does not
		});

		const context: InstallerContext = {};
		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(deps.fileSystem.createFile).toHaveBeenCalledTimes(1);
	});

	it("should fail and report which file failed on error", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.fileSystem.createFile).mockImplementation(async (path: string) => {
			if (path === SEED_CSV_PATH) {
				throw new Error("Permission denied");
			}
		});

		const context: InstallerContext = {};
		const result = await step.execute(context, deps);

		expect(result.status).toBe("failed");
		expect(result.message).toContain(SEED_CSV_PATH);
		expect(result.error).toBeDefined();
		expect(result.error!.message).toBe("Permission denied");
	});

	it("should set context.seededFiles with created file paths", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = {};

		await step.execute(context, deps);

		expect(context.seededFiles).toEqual([SEED_CSV_PATH, WELCOME_NOTE_PATH]);
	});

	it("should report partial seededFiles on failure", async () => {
		const deps = createMockDeps();
		// First file succeeds, second fails
		let callCount = 0;
		vi.mocked(deps.fileSystem.createFile).mockImplementation(async () => {
			callCount++;
			if (callCount === 2) {
				throw new Error("Disk full");
			}
		});

		const context: InstallerContext = {};
		await step.execute(context, deps);

		expect(context.seededFiles).toHaveLength(1);
		expect(context.seededFiles).toContain(SEED_CSV_PATH);
	});

	// ── Role-conditional session templates (Cycle 46, PBI-ONB-006) ──

	it("should seed 3 session templates for supplier-manager role", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice", role: "supplier-manager" };

		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		// 2 base files + 3 templates = 5
		expect(deps.fileSystem.createFile).toHaveBeenCalledTimes(5);
		expect(context.seededFiles).toHaveLength(5);
	});

	it("should write templates to correct paths for supplier-manager role", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice", role: "supplier-manager" };

		await step.execute(context, deps);

		const paths = vi.mocked(deps.fileSystem.createFile).mock.calls.map((c) => c[0]);
		expect(paths).toContain(SESSION_TEMPLATE_PATHS.supplierReview);
		expect(paths).toContain(SESSION_TEMPLATE_PATHS.kpiReview);
		expect(paths).toContain(SESSION_TEMPLATE_PATHS.procurementPlanning);
	});

	it("should NOT seed session templates for user role", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice", role: "user" };

		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(deps.fileSystem.createFile).toHaveBeenCalledTimes(2);
		expect(context.seededFiles).toHaveLength(2);
	});

	it("should NOT seed session templates when no role is set", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice" };

		await step.execute(context, deps);

		expect(deps.fileSystem.createFile).toHaveBeenCalledTimes(2);
	});

	it("should include YAML frontmatter in session templates", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice", role: "supplier-manager" };

		await step.execute(context, deps);

		const calls = vi.mocked(deps.fileSystem.createFile).mock.calls;
		const templateCall = calls.find((c) => c[0] === SESSION_TEMPLATE_PATHS.supplierReview);
		expect(templateCall).toBeDefined();
		const content = templateCall![1] as string;
		expect(content).toContain("type: SessionTemplate");
		expect(content).toContain("cadence: weekly");
		expect(content).toContain("role: supplier-manager");
	});

	it("should include seeded template paths in context.seededFiles", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = { userName: "Alice", role: "supplier-manager" };

		await step.execute(context, deps);

		expect(context.seededFiles).toContain(SESSION_TEMPLATE_PATHS.supplierReview);
		expect(context.seededFiles).toContain(SESSION_TEMPLATE_PATHS.kpiReview);
		expect(context.seededFiles).toContain(SESSION_TEMPLATE_PATHS.procurementPlanning);
	});

	it("should skip existing templates (idempotent)", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.fileSystem.fileExists).mockResolvedValue(true);
		const context: InstallerContext = { userName: "Alice", role: "supplier-manager" };

		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(deps.fileSystem.createFile).not.toHaveBeenCalled();
		// All 5 files counted as seeded (existing)
		expect(context.seededFiles).toHaveLength(5);
	});

	// ── CSV data validation ──

	it("should include realistic CSV with expected columns", () => {
		const header = SUPPLIER_OVERVIEW_CSV.split("\n")[0];
		expect(header).toBe(
			"Month,Supplier,SKU,Category,Unit Price,Quantity,Total,Lead Time Days,Quality Score,On Time Delivery",
		);

		const rows = SUPPLIER_OVERVIEW_CSV.split("\n").slice(1);
		expect(rows.length).toBe(48);
	});
});
