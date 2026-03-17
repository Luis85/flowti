// @vitest-environment happy-dom
import "../../mocks/obsidian-stub";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignalsTab } from "../../../src/ui/hub/SignalsTab";
import { SignalConfigModal } from "../../../src/ui/hub/SignalConfigModal";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { HubComponentDeps, HubState } from "../../../src/ui/hub/types";
import type { SignalConfig } from "../../../src/domain/signal/types";

// ── Helpers ───────────────────────────────────────────────

function makeSignal(overrides: Partial<SignalConfig> = {}): SignalConfig {
	return {
		id: "sig_test_1",
		name: "My Backlog",
		type: "azure-devops",
		orgUrl: "https://dev.azure.com/myorg",
		project: "MyProject",
		pat: "fake-pat",
		targetFolder: "signals/items",
		itemTypeFilter: ["Bug", "User Story"],
		conflictStrategy: "update",
		lastSync: "2026-02-20T10:00:00Z",
		lastSyncItemCount: 42,
		status: "connected",
		...overrides,
	};
}

function makeState(overrides: Partial<HubState> = {}): HubState {
	return {
		currentPage: "signals",
		importConfigs: [],
		exportConfigs: [],
		pipelineConfigs: [],
		dictionaryEntries: [],
		reportEntries: [],
		typeEntries: [],
		csvFileEntries: [],
		documentedProperties: new Set(),
		filterText: "",
		showHiddenCsvs: false,
		frontmatterIssues: [],
		activeOperations: [],
		canvasConfigs: [],
		selectedImportId: null,
		selectedExportId: null,
		selectedDictProp: null,
		selectedReportPath: null,
		selectedCsvFilePath: null,
		selectedPipelineId: null,
		selectedTypeName: null,
		selectedSignalId: null,
		selectedCanvasId: null,
		editingImportId: null,
		editingExportId: null,
		editingPipelineId: null,
		editingCanvasId: null,
		...overrides,
	};
}

function createMockSignalService(signals: SignalConfig[] = []) {
	return {
		getSignals: vi.fn(() => [...signals]),
		getSignal: vi.fn((id: string) => signals.find((s) => s.id === id)),
		configure: vi.fn(async () => makeSignal()),
		update: vi.fn(async () => makeSignal()),
		remove: vi.fn(async () => true),
		load: vi.fn(async () => {}),
		dispose: vi.fn(),
	};
}

function createMockDeps(
	overrides: {
		signals?: SignalConfig[];
		state?: Partial<HubState>;
		eventBus?: IEventBus;
	} = {},
): { deps: HubComponentDeps; state: HubState; signalService: ReturnType<typeof createMockSignalService> } {
	const signalService = createMockSignalService(overrides.signals ?? []);
	const state = makeState(overrides.state);
	return {
		deps: {
			app: {} as HubComponentDeps["app"],
			eventBus: overrides.eventBus ?? new EventBus(),
			dataExchangeService: {} as HubComponentDeps["dataExchangeService"],
			signalService: signalService as unknown as HubComponentDeps["signalService"],
			getState: () => state,
			setState: vi.fn((partial: Partial<HubState>) => Object.assign(state, partial)),
			navigation: {
				navigateTo: vi.fn(),
				showImportConfig: vi.fn(),
				openCsvImport: vi.fn(),
				openExport: vi.fn(),
				openNewExport: vi.fn(),
				openEventInCatalog: vi.fn(),
				createNewPipeline: vi.fn(),
				executeExportConfig: vi.fn(),
				runPipelinePreview: vi.fn(),
				executePipeline: vi.fn(),
				openCanvasImport: vi.fn(),
			},
			scheduleRender: vi.fn(),
		},
		state,
		signalService,
	};
}

// ── SignalsTab master panel ──────────────────────────────

describe("SignalsTab master panel", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
	});

	it("should render empty state when no signals", () => {
		const { deps } = createMockDeps();
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderMaster();

		expect(masterEl.textContent).toContain("No signals configured");
		expect(masterEl.textContent).toContain("Signals");
		expect(masterEl.textContent).toContain("0");
	});

	it("should render signal list with name and project", () => {
		const signal = makeSignal();
		const { deps } = createMockDeps({ signals: [signal] });
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderMaster();

		expect(masterEl.textContent).toContain("My Backlog");
		expect(masterEl.textContent).toContain("MyProject");
		expect(masterEl.textContent).toContain("1"); // count
	});

	it("should render status dot for each signal", () => {
		const signal = makeSignal({ status: "connected" });
		const { deps } = createMockDeps({ signals: [signal] });
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderMaster();

		const dot = masterEl.querySelector("[aria-label='connected']");
		expect(dot).not.toBeNull();
	});

	it("should show 'No matching signals' when filter active with no matches", () => {
		const signal = makeSignal();
		const { deps } = createMockDeps({
			signals: [signal],
			state: { filterText: "nonexistent" },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderMaster();

		expect(masterEl.textContent).toContain("No matching signals");
	});

	it("should highlight selected signal", () => {
		const signal = makeSignal();
		const { deps } = createMockDeps({
			signals: [signal],
			state: { selectedSignalId: signal.id },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderMaster();

		const selected = masterEl.querySelector(".ft-master-event-selected");
		expect(selected).not.toBeNull();
	});

	it("should render item count badge when items synced", () => {
		const signal = makeSignal({ lastSyncItemCount: 42 });
		const { deps } = createMockDeps({ signals: [signal] });
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderMaster();

		expect(masterEl.textContent).toContain("42");
	});

	it("should filter signals by name", () => {
		const signals = [
			makeSignal({ id: "sig_1", name: "Backlog", project: "Proj1" }),
			makeSignal({ id: "sig_2", name: "Sprint", project: "Proj2" }),
		];
		const { deps } = createMockDeps({
			signals,
			state: { filterText: "backlog" },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderMaster();

		expect(masterEl.textContent).toContain("Backlog");
		expect(masterEl.textContent).not.toContain("Sprint");
	});
});

// ── SignalsTab detail panel ──────────────────────────────

describe("SignalsTab detail panel", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
	});

	it("should render empty detail when no selection", () => {
		const { deps } = createMockDeps();
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderDetail();

		expect(detailEl.textContent).toContain("Select a signal to view details");
	});

	it("should show connection info for selected signal", () => {
		const signal = makeSignal();
		const { deps } = createMockDeps({
			signals: [signal],
			state: { selectedSignalId: signal.id },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderDetail();

		expect(detailEl.textContent).toContain("My Backlog");
		expect(detailEl.textContent).toContain("https://dev.azure.com/myorg");
		expect(detailEl.textContent).toContain("MyProject");
		expect(detailEl.textContent).toContain("update");
	});

	it("should show last sync info", () => {
		const signal = makeSignal({ lastSync: "2026-02-20T10:00:00Z", lastSyncItemCount: 42 });
		const { deps } = createMockDeps({
			signals: [signal],
			state: { selectedSignalId: signal.id },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderDetail();

		expect(detailEl.textContent).toContain("42 items synced");
	});

	it("should show 'Never synced' for null lastSync", () => {
		const signal = makeSignal({ lastSync: null, lastSyncItemCount: 0 });
		const { deps } = createMockDeps({
			signals: [signal],
			state: { selectedSignalId: signal.id },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderDetail();

		expect(detailEl.textContent).toContain("Never synced");
	});

	it("should show type filter in connection info", () => {
		const signal = makeSignal({ itemTypeFilter: ["Bug", "Task"] });
		const { deps } = createMockDeps({
			signals: [signal],
			state: { selectedSignalId: signal.id },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderDetail();

		expect(detailEl.textContent).toContain("Bug, Task");
	});

	it("should show type badge and status badge in header", () => {
		const signal = makeSignal({ type: "azure-devops", status: "connected" });
		const { deps } = createMockDeps({
			signals: [signal],
			state: { selectedSignalId: signal.id },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderDetail();

		expect(detailEl.textContent).toContain("azure-devops");
		expect(detailEl.textContent).toContain("connected");
	});

	it("should render 'Signal not found' when selected ID is stale", () => {
		const { deps } = createMockDeps({
			signals: [],
			state: { selectedSignalId: "sig_nonexistent" },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderDetail();

		expect(detailEl.textContent).toContain("Signal not found");
	});

	it("should render action buttons", () => {
		const signal = makeSignal();
		const { deps } = createMockDeps({
			signals: [signal],
			state: { selectedSignalId: signal.id },
		});
		const tab = new SignalsTab(masterEl, detailEl, deps);

		tab.renderDetail();

		expect(detailEl.textContent).toContain("Sync Now");
		expect(detailEl.textContent).toContain("Test Connection");
		expect(detailEl.textContent).toContain("Edit");
		expect(detailEl.textContent).toContain("Remove");
	});
});

// ── SignalConfigModal ────────────────────────────────────

describe("SignalConfigModal", () => {
	it("should accept constructor with new signal args", () => {
		const signalService = createMockSignalService();
		const onSave = vi.fn();

		const modal = new SignalConfigModal(
			{} as HubComponentDeps["app"],
			signalService as unknown as Parameters<typeof SignalConfigModal extends new (...args: infer P) => unknown ? (...args: P) => void : never>[1],
			onSave,
		);

		// Modal created without error
		expect(modal).toBeDefined();
	});

	it("should accept constructor with existing signal for editing", () => {
		const signalService = createMockSignalService();
		const signal = makeSignal();
		const onSave = vi.fn();

		const modal = new SignalConfigModal(
			{} as HubComponentDeps["app"],
			signalService as unknown as Parameters<typeof SignalConfigModal extends new (...args: infer P) => unknown ? (...args: P) => void : never>[1],
			onSave,
			signal,
		);

		expect(modal).toBeDefined();
	});
});

// ── DX Hub signals integration ───────────────────────────

describe("DX Hub signals integration", () => {
	it("should trigger re-render on signal.configured event", async () => {
		const eventBus = new EventBus();
		const renderSpy = vi.fn();

		eventBus.on("signal.configured", () => renderSpy());

		await eventBus.emit("signal.configured", {
			signalId: "sig_1",
			name: "Test",
			type: "azure-devops",
			project: "Proj",
		});

		expect(renderSpy).toHaveBeenCalledOnce();
	});

	it("should trigger re-render on signal.removed event", async () => {
		const eventBus = new EventBus();
		const renderSpy = vi.fn();

		eventBus.on("signal.removed", () => renderSpy());

		await eventBus.emit("signal.removed", {
			signalId: "sig_1",
			name: "Test",
		});

		expect(renderSpy).toHaveBeenCalledOnce();
	});
});
