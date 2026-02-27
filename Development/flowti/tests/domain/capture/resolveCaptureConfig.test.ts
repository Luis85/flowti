import { describe, it, expect } from "vitest";
import { resolveCaptureConfig, type CaptureConfigSettings } from "../../../src/domain/capture/resolveCaptureConfig";

function makeSettings(overrides?: Partial<CaptureConfigSettings>): CaptureConfigSettings {
	return {
		captureFolder: "00 - Connectivity/inbox",
		captureConfig: {
			defaultTemplate: "",
			overrides: {},
		},
		...overrides,
	};
}

describe("resolveCaptureConfig", () => {
	// ── defaults ─────────────────────────────────────────────

	it("should return captureFolder when no overrides exist", () => {
		const result = resolveCaptureConfig("idea", makeSettings());

		expect(result.folder).toBe("00 - Connectivity/inbox");
	});

	it("should return empty template when no default and no override", () => {
		const result = resolveCaptureConfig("idea", makeSettings());

		expect(result.template).toBe("");
	});

	it("should return default template when set and no override", () => {
		const settings = makeSettings({
			captureConfig: { defaultTemplate: "templates/capture.md", overrides: {} },
		});

		const result = resolveCaptureConfig("idea", settings);

		expect(result.template).toBe("templates/capture.md");
	});

	// ── per-type overrides ───────────────────────────────────

	it("should use folder override for matching type", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "",
				overrides: { idea: { folder: "ideas/inbox" } },
			},
		});

		const result = resolveCaptureConfig("idea", settings);

		expect(result.folder).toBe("ideas/inbox");
	});

	it("should use template override for matching type", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "templates/default.md",
				overrides: { bug: { template: "templates/bug-report.md" } },
			},
		});

		const result = resolveCaptureConfig("bug", settings);

		expect(result.template).toBe("templates/bug-report.md");
	});

	it("should use both folder and template from override", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "templates/default.md",
				overrides: {
					risk: { folder: "risks/inbox", template: "templates/risk.md" },
				},
			},
		});

		const result = resolveCaptureConfig("risk", settings);

		expect(result.folder).toBe("risks/inbox");
		expect(result.template).toBe("templates/risk.md");
	});

	// ── fallback behavior ────────────────────────────────────

	it("should fall back to captureFolder when override has no folder", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "",
				overrides: { idea: { template: "templates/idea.md" } },
			},
		});

		const result = resolveCaptureConfig("idea", settings);

		expect(result.folder).toBe("00 - Connectivity/inbox");
	});

	it("should fall back to defaultTemplate when override has no template", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "templates/default.md",
				overrides: { idea: { folder: "ideas/inbox" } },
			},
		});

		const result = resolveCaptureConfig("idea", settings);

		expect(result.template).toBe("templates/default.md");
	});

	it("should fall back to defaults for non-overridden type", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "templates/default.md",
				overrides: { bug: { folder: "bugs/" } },
			},
		});

		const result = resolveCaptureConfig("idea", settings);

		expect(result.folder).toBe("00 - Connectivity/inbox");
		expect(result.template).toBe("templates/default.md");
	});

	// ── edge cases ───────────────────────────────────────────

	it("should handle empty string folder override as fallback", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "",
				overrides: { idea: { folder: "" } },
			},
		});

		const result = resolveCaptureConfig("idea", settings);

		expect(result.folder).toBe("00 - Connectivity/inbox");
	});

	it("should handle empty string template override as fallback", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "templates/default.md",
				overrides: { idea: { template: "" } },
			},
		});

		const result = resolveCaptureConfig("idea", settings);

		expect(result.template).toBe("templates/default.md");
	});

	it("should resolve custom capture type from overrides", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "",
				overrides: { "meeting-notes": { folder: "meetings/" } },
			},
		});

		const result = resolveCaptureConfig("meeting-notes", settings);

		expect(result.folder).toBe("meetings/");
	});

	it("should handle multiple type overrides independently", () => {
		const settings = makeSettings({
			captureConfig: {
				defaultTemplate: "",
				overrides: {
					idea: { folder: "ideas/" },
					bug: { folder: "bugs/", template: "templates/bug.md" },
					task: { template: "templates/task.md" },
				},
			},
		});

		const idea = resolveCaptureConfig("idea", settings);
		const bug = resolveCaptureConfig("bug", settings);
		const task = resolveCaptureConfig("task", settings);
		const note = resolveCaptureConfig("note", settings);

		expect(idea.folder).toBe("ideas/");
		expect(idea.template).toBe("");

		expect(bug.folder).toBe("bugs/");
		expect(bug.template).toBe("templates/bug.md");

		expect(task.folder).toBe("00 - Connectivity/inbox");
		expect(task.template).toBe("templates/task.md");

		expect(note.folder).toBe("00 - Connectivity/inbox");
		expect(note.template).toBe("");
	});

	// ── backward compatibility ───────────────────────────────

	it("should work with different captureFolder values", () => {
		const settings = makeSettings({ captureFolder: "custom/capture/path" });

		const result = resolveCaptureConfig("idea", settings);

		expect(result.folder).toBe("custom/capture/path");
	});
});
