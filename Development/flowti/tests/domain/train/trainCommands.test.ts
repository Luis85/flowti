import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import { createCommandDefinitions } from "../../../src/infrastructure/commands/registry";
import type { CommandContext } from "../../../src/infrastructure/commands/types";

// ── Command definition tests ────────────────────────────

describe("Train command definitions", () => {
	function createCtx(): { ctx: CommandContext; eventBus: EventBus } {
		const eventBus = new EventBus();
		const ctx: CommandContext = {
			app: {} as CommandContext["app"],
			eventBus,
			logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as CommandContext["logger"],
		};
		return { ctx, eventBus };
	}

	const commands = createCommandDefinitions();

	it("registers flowti:resume-train command", () => {
		const cmd = commands.find((c) => c.id === "flowti:resume-train");
		expect(cmd).toBeDefined();
		expect(cmd!.name).toBe("Resume paused train");
		expect(cmd!.icon).toBe("play");
	});

	it("flowti:resume-train emits ui.resumeTrain", async () => {
		const { ctx, eventBus } = createCtx();
		const handler = vi.fn();
		eventBus.on("ui.resumeTrain", handler);

		const cmd = commands.find((c) => c.id === "flowti:resume-train")!;
		await cmd.handler(ctx);
		await new Promise((r) => setTimeout(r, 0));

		expect(handler).toHaveBeenCalledOnce();
	});

	it("registers flowti:complete-train command", () => {
		const cmd = commands.find((c) => c.id === "flowti:complete-train");
		expect(cmd).toBeDefined();
		expect(cmd!.name).toBe("Complete current train");
		expect(cmd!.icon).toBe("check-circle");
	});

	it("flowti:complete-train emits ui.completeTrain", async () => {
		const { ctx, eventBus } = createCtx();
		const handler = vi.fn();
		eventBus.on("ui.completeTrain", handler);

		const cmd = commands.find((c) => c.id === "flowti:complete-train")!;
		await cmd.handler(ctx);
		await new Promise((r) => setTimeout(r, 0));

		expect(handler).toHaveBeenCalledOnce();
	});

	it("registers flowti:open-train-canvas command", () => {
		const cmd = commands.find((c) => c.id === "flowti:open-train-canvas");
		expect(cmd).toBeDefined();
		expect(cmd!.name).toBe("Open train canvas");
		expect(cmd!.icon).toBe("layout-dashboard");
	});

	it("flowti:open-train-canvas emits ui.openTrainCanvas", async () => {
		const { ctx, eventBus } = createCtx();
		const handler = vi.fn();
		eventBus.on("ui.openTrainCanvas", handler);

		const cmd = commands.find((c) => c.id === "flowti:open-train-canvas")!;
		await cmd.handler(ctx);
		await new Promise((r) => setTimeout(r, 0));

		expect(handler).toHaveBeenCalledOnce();
	});

	it("registers flowti:open-train-timeline command", () => {
		const cmd = commands.find((c) => c.id === "flowti:open-train-timeline");
		expect(cmd).toBeDefined();
		expect(cmd!.name).toBe("Open train timeline sidebar");
		expect(cmd!.icon).toBe("git-branch");
	});

	it("flowti:open-train-timeline emits ui.openTrainTimeline", async () => {
		const { ctx, eventBus } = createCtx();
		const handler = vi.fn();
		eventBus.on("ui.openTrainTimeline", handler);

		const cmd = commands.find((c) => c.id === "flowti:open-train-timeline")!;
		await cmd.handler(ctx);
		await new Promise((r) => setTimeout(r, 0));

		expect(handler).toHaveBeenCalledOnce();
	});
});
