// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { ModalService } from "../../../src/infrastructure/ui/ModalService";
import type { NoticeService } from "../../../src/infrastructure/ui/NoticeService";

// ── Track modal instantiations ────────────────────────────────
const openedModals: Array<{ type: string; options: unknown }> = [];

vi.mock("../../../src/ui/capture/QuickCaptureModal", () => ({
	QuickCaptureModal: class {
		constructor(_app: unknown, options: unknown) {
			openedModals.push({ type: "QuickCaptureModal", options });
		}
		open() { /* noop */ }
	},
}));

vi.mock("../../../src/ui/train/TrainResumeModal", () => ({
	TrainResumeModal: class {
		constructor(_app: unknown, options: unknown) {
			openedModals.push({ type: "TrainResumeModal", options });
		}
		open() { /* noop */ }
	},
}));

vi.mock("../../../src/ui/train/TrainTypePickerModal", () => ({
	TrainTypePickerModal: class {
		constructor(_app: unknown, options: unknown) {
			openedModals.push({ type: "TrainTypePickerModal", options });
		}
		open() { /* noop */ }
	},
}));

vi.mock("../../../src/ui/train/TrainCaptureModal", () => ({
	TrainCaptureModal: class {
		constructor(_app: unknown, options: unknown) {
			openedModals.push({ type: "TrainCaptureModal", options });
		}
		open() { /* noop */ }
	},
}));

vi.mock("../../../src/ui/canvas/CanvasTemplatePickerModal", () => ({
	CanvasTemplatePickerModal: class {
		constructor(_app: unknown, options: unknown) {
			openedModals.push({ type: "CanvasTemplatePickerModal", options });
		}
		open() { /* noop */ }
	},
}));

/** Track InputModal instances for onClose simulation */
const inputModalInstances: Array<{ options: unknown; onClose: () => void }> = [];
vi.mock("../../../src/ui/modals", () => ({
	InputModal: class {
		private _options: unknown;
		onClose: () => void = () => { /* noop */ };
		constructor(_app: unknown, options: unknown) {
			this._options = options;
			openedModals.push({ type: "InputModal", options });
			inputModalInstances.push(this as unknown as { options: unknown; onClose: () => void });
		}
		open() { /* noop */ }
	},
}));

vi.mock("../../../src/domain/capture/resolveCaptureConfig", () => ({
	resolveCaptureConfig: vi.fn().mockReturnValue({ folder: "inbox", template: "" }),
}));

vi.mock("../../../src/domain/session/helpers", () => ({
	computeRemainingMs: vi.fn().mockReturnValue(60000),
}));

// ── Helpers ───────────────────────────────────────────────────

function createMockApp(): unknown {
	return {
		workspace: {
			openLinkText: vi.fn().mockResolvedValue(undefined),
		},
	};
}

function createMockNoticeService(): NoticeService {
	return {
		show: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		showInteractive: vi.fn(),
		showThrottled: vi.fn(),
		dispose: vi.fn(),
	} as unknown as NoticeService;
}

function createMockSettings() {
	return {
		captureFolder: "inbox",
		captureConfig: { defaultTemplate: "", overrides: {} },
		defaultTrainDuration: 25,
	};
}

function createMockCaptureService() {
	return {
		capture: vi.fn().mockResolvedValue({ title: "Test idea" }),
	};
}

function createMockTrainService() {
	return {
		getActiveTrain: vi.fn().mockReturnValue(null),
		getTrain: vi.fn().mockReturnValue(null),
		getHeadNode: vi.fn().mockReturnValue(null),
		startTrain: vi.fn().mockResolvedValue({ id: "t1", title: "Test", thoughts: [] }),
		addThought: vi.fn().mockResolvedValue({ id: "th1", title: "Thought 1" }),
		resume: vi.fn().mockResolvedValue(undefined),
		pause: vi.fn().mockResolvedValue(undefined),
		completeTrain: vi.fn().mockResolvedValue(undefined),
		renameThought: vi.fn().mockResolvedValue(undefined),
		findMergeDownTarget: vi.fn().mockReturnValue(null),
		mergeBranch: vi.fn().mockResolvedValue(undefined),
	};
}

function createMockCanvasSessionService() {
	return {
		startSession: vi.fn().mockResolvedValue({ canvasPath: "canvas/test.canvas" }),
	};
}

// ── Tests ─────────────────────────────────────────────────────

describe("ModalService", () => {
	let eventBus: IEventBus;
	let service: ModalService;
	let mockApp: ReturnType<typeof createMockApp>;
	let mockNotice: ReturnType<typeof createMockNoticeService>;
	let mockCapture: ReturnType<typeof createMockCaptureService>;
	let mockTrain: ReturnType<typeof createMockTrainService>;
	let mockCanvasSession: ReturnType<typeof createMockCanvasSessionService>;

	beforeEach(() => {
		openedModals.length = 0;
		inputModalInstances.length = 0;
		eventBus = new EventBus();
		mockApp = createMockApp();
		mockNotice = createMockNoticeService();
		mockCapture = createMockCaptureService();
		mockTrain = createMockTrainService();
		mockCanvasSession = createMockCanvasSessionService();

		service = new ModalService({
			app: mockApp as never,
			eventBus,
			noticeService: mockNotice,
			getSettings: createMockSettings as never,
		});
		service.setCaptureService(mockCapture as never);
		service.setTrainService(mockTrain as never);
		service.setCanvasSessionService(mockCanvasSession as never);
	});

	afterEach(() => {
		service.dispose();
	});

	// ── Constructor & lifecycle ─────────────────────────────

	describe("constructor", () => {
		it("should wire event subscriptions on construction", () => {
			// Verify by emitting an event and checking a modal opened
			void eventBus.emit("ui.openQuickCapture", {});
			expect(openedModals).toHaveLength(1);
		});
	});

	describe("dispose()", () => {
		it("should unsubscribe from all events", async () => {
			service.dispose();
			openedModals.length = 0;

			await eventBus.emit("ui.openQuickCapture", {});
			expect(openedModals).toHaveLength(0);
		});
	});

	// ── ui.openQuickCapture ─────────────────────────────────

	describe("handleOpenQuickCapture", () => {
		it("should open QuickCaptureModal when event fires", async () => {
			await eventBus.emit("ui.openQuickCapture", {});
			expect(openedModals).toHaveLength(1);
			expect(openedModals[0].type).toBe("QuickCaptureModal");
		});

		it("should pass type to resolveCaptureConfig", async () => {
			await eventBus.emit("ui.openQuickCapture", { type: "bug" });
			const opts = openedModals[0].options as { showTypeSelector: boolean; defaultType?: string };
			expect(opts.showTypeSelector).toBe(false);
			expect(opts.defaultType).toBe("bug");
		});

		it("should show type selector when no type specified", async () => {
			await eventBus.emit("ui.openQuickCapture", {});
			const opts = openedModals[0].options as { showTypeSelector: boolean };
			expect(opts.showTypeSelector).toBe(true);
		});

		it("should emit modal.opened event", async () => {
			const opened: Array<{ modalType: string }> = [];
			eventBus.on("modal.opened", (e) => { opened.push(e.payload); });

			await eventBus.emit("ui.openQuickCapture", {});
			expect(opened).toHaveLength(1);
			expect(opened[0].modalType).toBe("quickCapture");
		});

		it("should call captureService.capture on submit callback", async () => {
			await eventBus.emit("ui.openQuickCapture", {});
			const opts = openedModals[0].options as { onSubmit: (input: unknown) => void };
			opts.onSubmit({ type: "idea", title: "My idea" });

			// Wait for the async capture promise
			await vi.waitFor(() => {
				expect(mockCapture.capture).toHaveBeenCalledWith({ type: "idea", title: "My idea" });
			});
		});
	});

	// ── ui.captureIdea ──────────────────────────────────────

	describe("handleCaptureIdea", () => {
		it("should call captureService.capture with idea type", async () => {
			await eventBus.emit("ui.captureIdea", { title: "Quick thought" });

			await vi.waitFor(() => {
				expect(mockCapture.capture).toHaveBeenCalledWith({
					type: "idea",
					title: "Quick thought",
				});
			});
		});

		it("should show success notice after capture", async () => {
			await eventBus.emit("ui.captureIdea", { title: "Quick thought" });

			await vi.waitFor(() => {
				expect(mockNotice.success).toHaveBeenCalledWith("Captured: Test idea");
			});
		});

		it("should not throw if captureService is not set", async () => {
			const s2 = new ModalService({
				app: mockApp as never,
				eventBus: new EventBus(),
				noticeService: mockNotice,
				getSettings: createMockSettings as never,
			});

			// No captureService set — should silently skip
			expect(() => s2.dispose()).not.toThrow();
		});
	});

	// ── ui.startTrain ───────────────────────────────────────

	describe("handleStartTrain", () => {
		it("should open TrainTypePickerModal when no active train", async () => {
			mockTrain.getActiveTrain.mockReturnValue(null);

			await eventBus.emit("ui.startTrain", {});
			expect(openedModals).toHaveLength(1);
			expect(openedModals[0].type).toBe("TrainTypePickerModal");
		});

		it("should emit modal.opened for type picker", async () => {
			mockTrain.getActiveTrain.mockReturnValue(null);
			const opened: Array<{ modalType: string }> = [];
			eventBus.on("modal.opened", (e) => { opened.push(e.payload); });

			await eventBus.emit("ui.startTrain", {});
			expect(opened).toHaveLength(1);
			expect(opened[0].modalType).toBe("trainTypePicker");
		});

		it("should open TrainCaptureModal when train is running", async () => {
			mockTrain.getActiveTrain.mockReturnValue({
				id: "t1",
				title: "Running",
				status: "running",
				thoughts: [{ id: "th1", title: "First" }],
				relations: [],
				durationMinutes: 0,
			});
			mockTrain.getTrain.mockReturnValue({
				id: "t1",
				title: "Running",
				thoughts: [{ id: "th1", title: "First" }],
				relations: [],
				durationMinutes: 0,
			});

			await eventBus.emit("ui.startTrain", {});
			expect(openedModals).toHaveLength(1);
			expect(openedModals[0].type).toBe("TrainCaptureModal");
		});

		it("should open TrainResumeModal for paused train with branching", async () => {
			const headNode = { id: "th2", title: "Head" };
			const currentThought = { id: "th1", title: "Current" };
			// Last thought in array is the "viewed" thought — must differ from headNode
			mockTrain.getActiveTrain.mockReturnValue({
				id: "t1",
				title: "Paused",
				status: "paused",
				thoughts: [headNode, currentThought],
				relations: [],
			});
			mockTrain.getHeadNode.mockReturnValue(headNode);

			await eventBus.emit("ui.startTrain", {});
			expect(openedModals).toHaveLength(1);
			expect(openedModals[0].type).toBe("TrainResumeModal");
		});

		it("should resume and open capture modal for simple pause", async () => {
			const thought = { id: "th1", title: "Only" };
			mockTrain.getActiveTrain.mockReturnValue({
				id: "t1",
				title: "Paused",
				status: "paused",
				thoughts: [thought],
				relations: [],
			});
			// headNode same as current — no resume modal
			mockTrain.getHeadNode.mockReturnValue(thought);
			mockTrain.getTrain.mockReturnValue({
				id: "t1",
				title: "Paused",
				thoughts: [thought],
				relations: [],
				durationMinutes: 0,
			});

			await eventBus.emit("ui.startTrain", {});

			await vi.waitFor(() => {
				expect(mockTrain.resume).toHaveBeenCalledWith("t1");
			});
		});

		it("should not open any modal if trainService is not set", async () => {
			const bus = new EventBus();
			const s2 = new ModalService({
				app: mockApp as never,
				eventBus: bus,
				noticeService: mockNotice,
				getSettings: createMockSettings as never,
			});
			// No trainService set

			await bus.emit("ui.startTrain", {});
			expect(openedModals).toHaveLength(0);
			s2.dispose();
		});
	});

	// ── ui.startCanvasSession ───────────────────────────────

	describe("handleStartCanvasSession", () => {
		it("should open CanvasTemplatePickerModal", async () => {
			await eventBus.emit("ui.startCanvasSession", {});
			expect(openedModals).toHaveLength(1);
			expect(openedModals[0].type).toBe("CanvasTemplatePickerModal");
		});

		it("should emit modal.opened for canvas template picker", async () => {
			const opened: Array<{ modalType: string }> = [];
			eventBus.on("modal.opened", (e) => { opened.push(e.payload); });

			await eventBus.emit("ui.startCanvasSession", {});
			expect(opened).toHaveLength(1);
			expect(opened[0].modalType).toBe("canvasTemplatePicker");
		});

		it("should open InputModal in onSelect callback", async () => {
			await eventBus.emit("ui.startCanvasSession", {});
			const opts = openedModals[0].options as { onSelect: (t: unknown) => void };
			opts.onSelect({ id: "tpl1", name: "Brainstorm" });

			expect(openedModals).toHaveLength(2);
			expect(openedModals[1].type).toBe("InputModal");
		});

		it("should call canvasSessionService.startSession on submit", async () => {
			await eventBus.emit("ui.startCanvasSession", {});
			const pickerOpts = openedModals[0].options as { onSelect: (t: unknown) => void };
			pickerOpts.onSelect({ id: "tpl1", name: "Brainstorm" });

			const inputOpts = openedModals[1].options as { onSubmit: (goal: string) => void };
			inputOpts.onSubmit("My goal");

			await vi.waitFor(() => {
				expect(mockCanvasSession.startSession).toHaveBeenCalledWith({
					templateId: "tpl1",
					goal: "My goal",
					durationMinutes: 25,
				});
			});
		});

		it("should show success notice after session starts", async () => {
			await eventBus.emit("ui.startCanvasSession", {});
			const pickerOpts = openedModals[0].options as { onSelect: (t: unknown) => void };
			pickerOpts.onSelect({ id: "tpl1", name: "Brainstorm" });

			const inputOpts = openedModals[1].options as { onSubmit: (goal: string) => void };
			inputOpts.onSubmit("My goal");

			await vi.waitFor(() => {
				expect(mockNotice.success).toHaveBeenCalledWith("Canvas session started — Brainstorm");
			});
		});

		it("should show error notice if session fails", async () => {
			mockCanvasSession.startSession.mockRejectedValue(new Error("No template"));

			await eventBus.emit("ui.startCanvasSession", {});
			const pickerOpts = openedModals[0].options as { onSelect: (t: unknown) => void };
			pickerOpts.onSelect({ id: "tpl1", name: "Brainstorm" });

			const inputOpts = openedModals[1].options as { onSubmit: (goal: string) => void };
			inputOpts.onSubmit("My goal");

			await vi.waitFor(() => {
				expect(mockNotice.error).toHaveBeenCalledWith("Failed to start canvas session: No template");
			});
		});
	});

	// ── Service setters ─────────────────────────────────────

	describe("service setters", () => {
		it("should accept captureService via setter", () => {
			const s2 = new ModalService({
				app: mockApp as never,
				eventBus: new EventBus(),
				noticeService: mockNotice,
				getSettings: createMockSettings as never,
			});
			expect(() => s2.setCaptureService(mockCapture as never)).not.toThrow();
			s2.dispose();
		});

		it("should accept trainService via setter", () => {
			const s2 = new ModalService({
				app: mockApp as never,
				eventBus: new EventBus(),
				noticeService: mockNotice,
				getSettings: createMockSettings as never,
			});
			expect(() => s2.setTrainService(mockTrain as never)).not.toThrow();
			s2.dispose();
		});

		it("should accept sessionService via setter", () => {
			const s2 = new ModalService({
				app: mockApp as never,
				eventBus: new EventBus(),
				noticeService: mockNotice,
				getSettings: createMockSettings as never,
			});
			expect(() => s2.setSessionService({} as never)).not.toThrow();
			s2.dispose();
		});

		it("should accept canvasSessionService via setter", () => {
			const s2 = new ModalService({
				app: mockApp as never,
				eventBus: new EventBus(),
				noticeService: mockNotice,
				getSettings: createMockSettings as never,
			});
			expect(() => s2.setCanvasSessionService(mockCanvasSession as never)).not.toThrow();
			s2.dispose();
		});
	});

	// ── openTextPrompt ──────────────────────────────────────

	describe("openTextPrompt", () => {
		it("should open an InputModal with correct config", () => {
			void service.openTextPrompt({
				title: "Enter name",
				message: "What is your name?",
				placeholder: "Name...",
				submitLabel: "OK",
			});

			expect(openedModals).toHaveLength(1);
			expect(openedModals[0].type).toBe("InputModal");
			const opts = openedModals[0].options as {
				title: string;
				inputDesc: string;
				placeholder: string;
				submitLabel: string;
			};
			expect(opts.title).toBe("Enter name");
			expect(opts.inputDesc).toBe("What is your name?");
			expect(opts.placeholder).toBe("Name...");
			expect(opts.submitLabel).toBe("OK");
		});

		it("should resolve with value on submit", async () => {
			const promise = service.openTextPrompt({
				title: "Input",
				message: "Enter value",
			});

			const opts = openedModals[0].options as { onSubmit: (v: string) => void };
			opts.onSubmit("hello");

			const result = await promise;
			expect(result).toBe("hello");
		});

		it("should resolve with null when cancelled (closed without submit)", async () => {
			const promise = service.openTextPrompt({
				title: "Input",
			});

			// Simulate close without submit
			const instance = inputModalInstances[inputModalInstances.length - 1];
			instance.onClose();

			const result = await promise;
			expect(result).toBeNull();
		});

		it("should emit modal.textPrompt.submitted on submit", async () => {
			const submitted: Array<{ value: string }> = [];
			eventBus.on("modal.textPrompt.submitted", (e) => { submitted.push(e.payload); });

			const promise = service.openTextPrompt({ title: "Test" });
			const opts = openedModals[0].options as { onSubmit: (v: string) => void };
			opts.onSubmit("my value");
			await promise;

			expect(submitted).toHaveLength(1);
			expect(submitted[0].value).toBe("my value");
		});

		it("should emit modal.textPrompt.cancelled when closed without submit", async () => {
			const cancelled: unknown[] = [];
			eventBus.on("modal.textPrompt.cancelled", () => { cancelled.push(true); });

			const promise = service.openTextPrompt({ title: "Test" });
			const instance = inputModalInstances[inputModalInstances.length - 1];
			instance.onClose();
			await promise;

			expect(cancelled).toHaveLength(1);
		});

		it("should emit modal.opened with textPrompt type", () => {
			const opened: Array<{ modalType: string }> = [];
			eventBus.on("modal.opened", (e) => { opened.push(e.payload); });

			void service.openTextPrompt({ title: "Test" });

			expect(opened).toHaveLength(1);
			expect(opened[0].modalType).toBe("textPrompt");
		});

		it("should not emit cancelled when submitted and then closed", async () => {
			const cancelled: unknown[] = [];
			eventBus.on("modal.textPrompt.cancelled", () => { cancelled.push(true); });

			const promise = service.openTextPrompt({ title: "Test" });
			const opts = openedModals[0].options as { onSubmit: (v: string) => void };
			opts.onSubmit("value");
			await promise;

			// Close after submit
			const instance = inputModalInstances[inputModalInstances.length - 1];
			instance.onClose();

			expect(cancelled).toHaveLength(0);
		});

		it("should open text prompt via ui.openTextPrompt event", async () => {
			await eventBus.emit("ui.openTextPrompt", {
				title: "Event Prompt",
				message: "Via event",
				placeholder: "type here",
				submitLabel: "Send",
			});

			expect(openedModals).toHaveLength(1);
			expect(openedModals[0].type).toBe("InputModal");
			const opts = openedModals[0].options as { title: string; inputDesc: string };
			expect(opts.title).toBe("Event Prompt");
			expect(opts.inputDesc).toBe("Via event");
		});

		it("should use defaults for optional config fields", () => {
			void service.openTextPrompt({ title: "Minimal" });

			const opts = openedModals[0].options as {
				inputDesc: string;
				placeholder: string;
				submitLabel: string;
			};
			expect(opts.inputDesc).toBe("");
			expect(opts.placeholder).toBe("");
			expect(opts.submitLabel).toBe("Submit");
		});
	});

	// ── openTrainModal (via running train) ──────────────────

	describe("openTrainModal", () => {
		it("should pass previousThoughtTitle and count from train state", async () => {
			mockTrain.getActiveTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				status: "running",
				thoughts: [{ id: "th1", title: "First thought" }, { id: "th2", title: "Second" }],
				relations: [],
			});
			mockTrain.getTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				thoughts: [{ id: "th1", title: "First thought" }, { id: "th2", title: "Second" }],
				relations: [],
				durationMinutes: 0,
			});
			mockTrain.findMergeDownTarget.mockReturnValue(null);

			await eventBus.emit("ui.startTrain", {});

			expect(openedModals).toHaveLength(1);
			expect(openedModals[0].type).toBe("TrainCaptureModal");
			const opts = openedModals[0].options as { previousThoughtTitle: string | null; thoughtCount: number };
			expect(opts.previousThoughtTitle).toBe("Second");
			expect(opts.thoughtCount).toBe(2);
		});

		it("should call trainService.completeTrain on onComplete", async () => {
			mockTrain.getActiveTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				status: "running",
				thoughts: [{ id: "th1", title: "First" }],
				relations: [],
			});
			mockTrain.getTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				thoughts: [{ id: "th1", title: "First" }],
				relations: [],
				durationMinutes: 0,
			});
			mockTrain.findMergeDownTarget.mockReturnValue(null);

			await eventBus.emit("ui.startTrain", {});

			const opts = openedModals[0].options as { onComplete: () => void };
			opts.onComplete();

			expect(mockTrain.completeTrain).toHaveBeenCalledWith("t1");
		});

		it("should call trainService.pause on onCancel", async () => {
			mockTrain.getActiveTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				status: "running",
				thoughts: [{ id: "th1", title: "First" }],
				relations: [],
			});
			mockTrain.getTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				thoughts: [{ id: "th1", title: "First" }],
				relations: [],
				durationMinutes: 0,
			});
			mockTrain.findMergeDownTarget.mockReturnValue(null);

			await eventBus.emit("ui.startTrain", {});

			const opts = openedModals[0].options as { onCancel: () => void };
			opts.onCancel();

			expect(mockTrain.pause).toHaveBeenCalledWith("t1");
		});

		it("should call addThought on onSubmit", async () => {
			mockTrain.getActiveTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				status: "running",
				thoughts: [{ id: "th1", title: "First" }],
				relations: [],
			});
			mockTrain.getTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				thoughts: [{ id: "th1", title: "First" }],
				relations: [],
				durationMinutes: 0,
			});
			mockTrain.findMergeDownTarget.mockReturnValue(null);

			await eventBus.emit("ui.startTrain", {});

			const opts = openedModals[0].options as { onSubmit: (title: string, direction: string) => void };
			opts.onSubmit("New thought", "next");

			await vi.waitFor(() => {
				expect(mockTrain.addThought).toHaveBeenCalledWith(
					"t1",
					"New thought",
					{ direction: "next", fromThoughtId: undefined },
				);
			});
		});

		it("should emit train.thought.activated when fromThoughtId is provided", async () => {
			const activated: Array<{ trainId: string; thoughtId: string }> = [];
			eventBus.on("train.thought.activated", (e) => { activated.push(e.payload); });

			mockTrain.getActiveTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				status: "running",
				thoughts: [
					{ id: "th1", title: "First" },
					{ id: "th2", title: "Second" },
				],
				relations: [],
			});
			mockTrain.getTrain.mockReturnValue({
				id: "t1",
				title: "Active",
				thoughts: [
					{ id: "th1", title: "First" },
					{ id: "th2", title: "Second" },
				],
				relations: [],
				durationMinutes: 0,
			});
			mockTrain.findMergeDownTarget.mockReturnValue(null);

			await eventBus.emit("ui.startTrain", { fromThoughtId: "th1" });

			expect(activated).toHaveLength(1);
			expect(activated[0].thoughtId).toBe("th1");
		});
	});
});
