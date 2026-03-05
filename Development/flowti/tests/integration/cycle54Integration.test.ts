/**
 * Cycle 54 integration smoke tests — verify cross-feature wiring.
 *
 * Checks that new features (Canvas Sessions, Signal Health, Inbox Routing)
 * are properly registered and connected to the existing system.
 */
import { describe, it, expect } from "vitest";

import { SESSION_TYPES, SESSION_TYPE_CONFIGS } from "../../src/domain/session/types";
import type { SessionType } from "../../src/domain/session/types";
import { SESSION_TYPE_LABELS } from "../../src/ui/userHub/types";
import { getEventEntry } from "../../src/infrastructure/events/catalog";
import { CANVAS_TEMPLATES } from "../../src/domain/canvas/templates/canvasTemplates";
import { DEFAULT_ROUTING_RULES, InboxAutoRouter } from "../../src/domain/inbox/InboxAutoRouter";
import { SignalHealthMonitor } from "../../src/domain/signal/SignalHealthMonitor";

describe("Cycle 54 integration", () => {

	describe("Canvas Sessions wiring", () => {
		it("canvas-session is a registered SessionType", () => {
			const types = SESSION_TYPES.map((t) => t.type);
			expect(types).toContain("canvas-session");
		});

		it("canvas-session has a config", () => {
			const config = SESSION_TYPE_CONFIGS["canvas-session" as SessionType];
			expect(config).toBeDefined();
			expect(config.label).toBe("Canvas Session");
			expect(config.icon).toBe("layout-template");
		});

		it("canvas-session has a display label", () => {
			expect(SESSION_TYPE_LABELS["canvas-session"]).toBe("Canvas Session");
		});

		it("canvas templates are available (6 templates)", () => {
			expect(CANVAS_TEMPLATES).toHaveLength(6);
		});

		it("canvas events are catalogued", () => {
			expect(getEventEntry("canvas.template.created")).toBeDefined();
			expect(getEventEntry("canvas.session.started")).toBeDefined();
			expect(getEventEntry("canvas.session.activity")).toBeDefined();
			expect(getEventEntry("canvas.session.completed")).toBeDefined();
		});
	});

	describe("Signal Health wiring", () => {
		it("signal health events are catalogued", () => {
			expect(getEventEntry("signal.health.checked")).toBeDefined();
			expect(getEventEntry("signal.health.changed")).toBeDefined();
		});

		it("signal auth/connection error events are catalogued", () => {
			expect(getEventEntry("signal.auth.expired")).toBeDefined();
			expect(getEventEntry("signal.connection.failed")).toBeDefined();
		});

		it("health monitor tracks status transitions correctly", () => {
			const monitor = new SignalHealthMonitor();
			expect(monitor.getHealth("x").status).toBe("unknown");
			monitor.recordSuccess("x");
			expect(monitor.getHealth("x").status).toBe("healthy");
			monitor.recordFailure("x", "err");
			expect(monitor.getHealth("x").status).toBe("degraded");
			monitor.recordFailure("x", "err");
			monitor.recordFailure("x", "err");
			expect(monitor.getHealth("x").status).toBe("unreachable");
			monitor.recordSuccess("x");
			expect(monitor.getHealth("x").status).toBe("healthy");
		});
	});

	describe("Inbox Auto-Routing wiring", () => {
		it("inbox.file.routed event is catalogued", () => {
			expect(getEventEntry("inbox.file.routed")).toBeDefined();
		});

		it("default routing rules cover 4 types", () => {
			expect(DEFAULT_ROUTING_RULES).toHaveLength(4);
			const types = DEFAULT_ROUTING_RULES.map((r) => r.type);
			expect(types).toContain("idea");
			expect(types).toContain("feature");
			expect(types).toContain("bug");
			expect(types).toContain("learning");
		});

		it("router is disabled by default", () => {
			const router = new InboxAutoRouter();
			expect(router.isEnabled()).toBe(false);
			const result = router.evaluate("inbox/note.md", "idea");
			expect(result.shouldRoute).toBe(false);
		});
	});
});
