import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/mock/cli-project",
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(),
}));

import * as filesystemMod from "../../../src/infrastructure/filesystem.js";
import { readProjectConfig } from "../../../src/domain/project/project-config.js";
import { ReportService } from "../../../src/domain/reports/cli/report-service.js";
import { Document } from "../../../src/infrastructure/document.js";

const mockReadConfig = readProjectConfig as ReturnType<typeof vi.fn>;

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(filesystemMod, { disk: mockFs });
}

beforeEach(() => {
	mockReadConfig.mockReset();
	mockReadConfig.mockReturnValue({ config: null, warnings: [] });
});

describe("ReportService", () => {
	it("uses default reports dir when no config", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const svc = new ReportService("/my-project");
		expect(svc.reportsDir).toBe(path.join("/my-project", "reports"));
	});

	it("uses configured reports dir", () => {
		mockReadConfig.mockReturnValue({ config: { reports: { dir: "output/reports" } }, warnings: [] });
		const svc = new ReportService("/my-project");
		expect(svc.reportsDir).toBe(path.join("/my-project", "output/reports"));
	});

	it("subdir resolves within reports dir", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const svc = new ReportService("/proj");
		expect(svc.subdir("tests")).toBe(path.join("/proj", "reports", "tests"));
	});

	it("stablePath resolves within reports dir", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const svc = new ReportService("/proj");
		expect(svc.stablePath("Test Report.md")).toBe(path.join("/proj", "reports", "Test Report.md"));
	});

	it("save writes timestamped and stable files", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const fs = createMockFs();
		setDisk(fs);

		const svc = new ReportService("/proj");
		const doc = Document.create("Test").text("Hello");

		const result = svc.save(doc, {
			subdir: "tests",
			slug: "test-report",
			stableFilename: "Test Report.md",
		});

		// Timestamped file in subdir
		expect(result).toContain(path.join("/proj", "reports", "tests"));
		expect(result).toContain("test-report.md");

		// Stable file at reports root
		const stableKey = [...fs.files.keys()].find(k => k.endsWith("Test Report.md"));
		expect(stableKey).toBeDefined();
	});

	it("save copies source JSON when provided and exists", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const fs = createMockFs({
			"/data/source.json": '{"data": true}',
		});
		setDisk(fs);

		const svc = new ReportService("/proj");
		const doc = Document.create("Test").text("Hello");

		svc.save(doc, {
			subdir: "tests",
			slug: "test-report",
			stableFilename: "Test Report.md",
			sourceJson: "/data/source.json",
		});

		const jsonCopy = [...fs.files.keys()].find(k => k.endsWith("test-report.json"));
		expect(jsonCopy).toBeDefined();
		expect(fs.files.get(jsonCopy!)).toBe('{"data": true}');
	});

	it("save skips JSON copy when source does not exist", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const fs = createMockFs();
		setDisk(fs);

		const svc = new ReportService("/proj");
		const doc = Document.create("Test").text("Hello");

		svc.save(doc, {
			subdir: "tests",
			slug: "test-report",
			stableFilename: "Test Report.md",
			sourceJson: "/nonexistent.json",
		});

		const jsonFiles = [...fs.files.keys()].filter(k => k.endsWith(".json"));
		expect(jsonFiles).toHaveLength(0);
	});

	it("coverageDir uses config or default", () => {
		mockReadConfig.mockReturnValue({ config: { reports: { dir: "custom/reports" } }, warnings: [] });
		const svc = new ReportService("/proj");
		expect(svc.coverageDir).toBe("custom/reports/coverage");
	});

	it("coverageDir defaults to reports/coverage", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const svc = new ReportService("/proj");
		expect(svc.coverageDir).toBe("reports/coverage");
	});

	it("referenceDir defaults to docs/reference", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const svc = new ReportService("/proj");
		expect(svc.referenceDir).toBe(path.join("/proj", "docs/reference"));
	});

	it("referenceDir uses configured docs.referenceDir", () => {
		mockReadConfig.mockReturnValue({ config: { docs: { referenceDir: "output/ref" } }, warnings: [] });
		const svc = new ReportService("/proj");
		expect(svc.referenceDir).toBe(path.join("/proj", "output/ref"));
	});

	it("saveReference writes a single file to referenceDir", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const fs = createMockFs();
		setDisk(fs);

		const svc = new ReportService("/proj");
		const doc = Document.create("Test Ref").text("Reference content");

		const result = svc.saveReference(doc, "My Reference.md");

		expect(result).toBe(path.join("/proj", "docs/reference", "My Reference.md"));
		const written = [...fs.files.keys()].find(k => k.endsWith("My Reference.md"));
		expect(written).toBeDefined();
	});

	it("saveReference creates referenceDir if it does not exist", () => {
		mockReadConfig.mockReturnValue({ config: null, warnings: [] });
		const fs = createMockFs();
		setDisk(fs);

		const svc = new ReportService("/proj");
		const doc = Document.create("Test").text("Content");

		svc.saveReference(doc, "Ref.md");

		// The file should have been written (which implies dir was created)
		const refFile = [...fs.files.keys()].find(k => k.endsWith("Ref.md"));
		expect(refFile).toBeDefined();
	});
});
