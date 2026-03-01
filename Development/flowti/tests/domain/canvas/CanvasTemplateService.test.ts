import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanvasTemplateService } from "../../../src/domain/canvas/CanvasTemplateService";
import { CANVAS_TEMPLATES } from "../../../src/domain/canvas/templates/canvasTemplates";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { createMockFileSystemStub } from "../../mocks/filesystem";

function createMockEventBus(): IEventBus & { _emitted: Array<{ type: string; payload: unknown }> } {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		_emitted: emitted,
	} as unknown as IEventBus & { _emitted: typeof emitted };
}

describe("CanvasTemplateService", () => {
	let service: CanvasTemplateService;
	let fileSystem: IFileSystemClient;
	let eventBus: ReturnType<typeof createMockEventBus>;

	beforeEach(() => {
		fileSystem = createMockFileSystemStub();
		eventBus = createMockEventBus();
		service = new CanvasTemplateService({ fileSystem, eventBus });
	});

	describe("getTemplates()", () => {
		it("returns all registered templates", () => {
			const templates = service.getTemplates();
			expect(templates).toHaveLength(CANVAS_TEMPLATES.length);
		});
	});

	describe("getTemplate()", () => {
		it("returns a template by ID", () => {
			const t = service.getTemplate("domain-design");
			expect(t).toBeDefined();
			expect(t!.name).toBe("Domain Design");
		});

		it("returns undefined for unknown ID", () => {
			expect(service.getTemplate("nope")).toBeUndefined();
		});
	});

	describe("createFromTemplate()", () => {
		it("creates a canvas file at the given path", async () => {
			await service.createFromTemplate("domain-design", "sessions/DD.canvas");

			expect(fileSystem.createFile).toHaveBeenCalledOnce();
			const [path, content, opts] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toBe("sessions/DD.canvas");
			expect(opts).toEqual({ createFolders: true });

			const parsed = JSON.parse(content);
			expect(parsed.nodes.length).toBeGreaterThan(0);
			expect(parsed.edges.length).toBeGreaterThan(0);
		});

		it("emits canvas.template.created event", async () => {
			await service.createFromTemplate("retrospective", "retro.canvas");

			expect(eventBus.emit).toHaveBeenCalledWith("canvas.template.created", {
				templateId: "retrospective",
				templateName: "Retrospective",
				canvasPath: "retro.canvas",
			});
		});

		it("returns the canvas path", async () => {
			const path = await service.createFromTemplate("brainstorm", "brain.canvas");
			expect(path).toBe("brain.canvas");
		});

		it("throws for unknown template ID", async () => {
			await expect(
				service.createFromTemplate("nonexistent", "test.canvas"),
			).rejects.toThrow("Unknown canvas template: nonexistent");
		});

		it("writes valid JSON for each template", async () => {
			for (const template of CANVAS_TEMPLATES) {
				await service.createFromTemplate(template.id, `${template.id}.canvas`);
			}

			const calls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			expect(calls).toHaveLength(CANVAS_TEMPLATES.length);

			for (const [, content] of calls) {
				const parsed = JSON.parse(content);
				expect(parsed.nodes).toBeDefined();
				expect(parsed.edges).toBeDefined();
			}
		});
	});
});
