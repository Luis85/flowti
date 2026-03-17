import { describe, it, expect } from "vitest";
import {
	SessionArtifactSchema,
	SessionTemplateSchema,
	SessionTemplateExportSchema,
} from "../../../src/domain/session/schemas";

describe("SessionArtifactSchema", () => {
	it("accepts valid artifact", () => {
		const result = SessionArtifactSchema.safeParse({
			path: "notes/note.md",
			action: "created",
			timestamp: "2026-03-06T10:00:00Z",
		});
		expect(result.success).toBe(true);
	});

	it("rejects missing path", () => {
		const result = SessionArtifactSchema.safeParse({
			action: "created",
			timestamp: "2026-03-06T10:00:00Z",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid action", () => {
		const result = SessionArtifactSchema.safeParse({
			path: "notes/note.md",
			action: "deleted",
			timestamp: "2026-03-06T10:00:00Z",
		});
		expect(result.success).toBe(false);
	});
});

describe("SessionTemplateSchema", () => {
	const validTemplate = {
		id: "t1",
		name: "Deep Work",
		type: "documentation",
		durationMinutes: 25,
		createdAt: 1709000000000,
	};

	it("accepts valid template", () => {
		const result = SessionTemplateSchema.safeParse(validTemplate);
		expect(result.success).toBe(true);
	});

	it("rejects missing name", () => {
		const result = SessionTemplateSchema.safeParse({ ...validTemplate, name: "" });
		expect(result.success).toBe(false);
	});

	it("rejects negative duration", () => {
		const result = SessionTemplateSchema.safeParse({ ...validTemplate, durationMinutes: -5 });
		expect(result.success).toBe(false);
	});

	it("accepts optional fields", () => {
		const result = SessionTemplateSchema.safeParse({
			...validTemplate,
			description: "A template",
			focusFile: "file.md",
			goals: ["goal 1"],
			decisions: ["decision 1"],
			tasks: ["task 1"],
			notes: "Some notes",
			contextBindings: [{ path: "domain/", type: "folder" }],
			reflections: [{ type: "observation", content: "noted" }],
		});
		expect(result.success).toBe(true);
	});
});

describe("SessionTemplateExportSchema", () => {
	const validExport = {
		version: 1,
		template: {
			name: "Sprint Planning",
			type: "backlog-structuring",
			durationMinutes: 50,
		},
	};

	it("accepts valid export", () => {
		const result = SessionTemplateExportSchema.safeParse(validExport);
		expect(result.success).toBe(true);
	});

	it("rejects wrong version", () => {
		const result = SessionTemplateExportSchema.safeParse({ ...validExport, version: 2 });
		expect(result.success).toBe(false);
	});

	it("rejects missing template name", () => {
		const result = SessionTemplateExportSchema.safeParse({
			version: 1,
			template: { type: "documentation", durationMinutes: 25 },
		});
		expect(result.success).toBe(false);
	});

	it("rejects zero duration", () => {
		const result = SessionTemplateExportSchema.safeParse({
			version: 1,
			template: { name: "Test", type: "documentation", durationMinutes: 0 },
		});
		expect(result.success).toBe(false);
	});
});
