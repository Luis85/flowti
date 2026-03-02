// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { NoticeService } from "../../../src/infrastructure/ui/NoticeService";

// Mock Obsidian's Notice class
const mockNoticeInstances: Array<{ message: string; duration?: number; noticeEl: HTMLElement }> = [];
vi.mock("obsidian", () => ({
	Notice: class {
		noticeEl: HTMLElement;
		constructor(message: string, duration?: number) {
			this.noticeEl = document.createElement("div");
			(this.noticeEl as unknown as { empty: () => void }).empty = vi.fn();
			mockNoticeInstances.push({ message, duration, noticeEl: this.noticeEl });
		}
	},
}));

describe("NoticeService", () => {
	let eventBus: IEventBus;
	let service: NoticeService;

	beforeEach(() => {
		vi.useFakeTimers();
		mockNoticeInstances.length = 0;
		eventBus = new EventBus();
		service = new NoticeService({ eventBus });
	});

	afterEach(() => {
		service.dispose();
		vi.useRealTimers();
	});

	// ── Direct API ──────────────────────────────────────────

	describe("show()", () => {
		it("should create a Notice with message", () => {
			service.show("Hello");
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("Hello");
			expect(mockNoticeInstances[0].duration).toBeUndefined();
		});

		it("should pass custom duration", () => {
			service.show("Hello", 8000);
			expect(mockNoticeInstances[0].duration).toBe(8000);
		});
	});

	describe("success()", () => {
		it("should create a Notice with default duration", () => {
			service.success("Done!");
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("Done!");
		});
	});

	describe("error()", () => {
		it("should create a Notice with 5000ms default duration", () => {
			service.error("Failed");
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("Failed");
			expect(mockNoticeInstances[0].duration).toBe(5000);
		});

		it("should use custom duration when provided", () => {
			service.error("Failed", 10000);
			expect(mockNoticeInstances[0].duration).toBe(10000);
		});
	});

	describe("showInteractive()", () => {
		it("should create a Notice and replace content with fragment", () => {
			const fragment = document.createDocumentFragment();
			const span = document.createElement("span");
			span.textContent = "interactive";
			fragment.appendChild(span);

			service.showInteractive(fragment, 30000);

			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("");
			expect(mockNoticeInstances[0].duration).toBe(30000);
		});
	});

	// ── Throttled API ───────────────────────────────────────

	describe("showThrottled()", () => {
		it("should show a single notice after the throttle window", () => {
			service.showThrottled("import", "Imported item");

			expect(mockNoticeInstances).toHaveLength(0);
			vi.advanceTimersByTime(2000);
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("Imported item");
		});

		it("should batch multiple calls under the same key", () => {
			service.showThrottled("import", "Imported item");
			service.showThrottled("import", "Imported item");
			service.showThrottled("import", "Imported item");

			vi.advanceTimersByTime(2000);
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("Imported item (+2 more)");
		});

		it("should keep separate batches for different keys", () => {
			service.showThrottled("import", "Imported");
			service.showThrottled("export", "Exported");

			vi.advanceTimersByTime(2000);
			expect(mockNoticeInstances).toHaveLength(2);
		});
	});

	// ── Event-driven API ────────────────────────────────────

	describe("notice.show event", () => {
		it("should create a Notice when event is emitted", async () => {
			await eventBus.emit("notice.show", { message: "Event notice" });
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("Event notice");
		});

		it("should pass duration from event payload", async () => {
			await eventBus.emit("notice.show", { message: "Timed", duration: 8000 });
			expect(mockNoticeInstances[0].duration).toBe(8000);
		});
	});

	describe("notice.success event", () => {
		it("should create a success Notice", async () => {
			await eventBus.emit("notice.success", { message: "All good" });
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("All good");
		});
	});

	describe("notice.error event", () => {
		it("should create an error Notice with default 5000ms", async () => {
			await eventBus.emit("notice.error", { message: "Oops" });
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("Oops");
			expect(mockNoticeInstances[0].duration).toBe(5000);
		});

		it("should use custom duration from payload", async () => {
			await eventBus.emit("notice.error", { message: "Oops", duration: 10000 });
			expect(mockNoticeInstances[0].duration).toBe(10000);
		});
	});

	describe("notice.throttled event", () => {
		it("should batch via the throttle mechanism", async () => {
			await eventBus.emit("notice.throttled", { key: "k", message: "msg" });
			await eventBus.emit("notice.throttled", { key: "k", message: "msg" });

			expect(mockNoticeInstances).toHaveLength(0);
			vi.advanceTimersByTime(2000);
			expect(mockNoticeInstances).toHaveLength(1);
			expect(mockNoticeInstances[0].message).toBe("msg (+1 more)");
		});
	});

	// ── Disposal ────────────────────────────────────────────

	describe("dispose()", () => {
		it("should clear pending batch timers", () => {
			service.showThrottled("key", "msg");
			service.dispose();

			vi.advanceTimersByTime(5000);
			expect(mockNoticeInstances).toHaveLength(0);
		});

		it("should unsubscribe from events", async () => {
			service.dispose();

			await eventBus.emit("notice.show", { message: "ignored" });
			expect(mockNoticeInstances).toHaveLength(0);
		});
	});
});
