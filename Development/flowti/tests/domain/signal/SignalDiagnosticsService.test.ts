import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignalDiagnosticsService } from "../../../src/domain/signal/SignalDiagnosticsService";
import type { SignalAdapter, TestConnectionResult } from "../../../src/domain/signal/adapters/SignalAdapter";
import type { SignalConfig } from "../../../src/domain/signal/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";

function createMockAdapter(result?: Partial<TestConnectionResult>): SignalAdapter {
	return {
		testConnection: vi.fn(async () => ({
			success: true,
			...result,
		})),
		fetchItems: vi.fn(async () => ({ items: [], errors: [] })),
	};
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
	} as unknown as IEventBus;
}

function createSignalConfig(overrides?: Partial<SignalConfig>): SignalConfig {
	return {
		id: "sig-1",
		name: "Test Signal",
		type: "azure-devops",
		orgUrl: "https://dev.azure.com/org",
		project: "MyProject",
		pat: "token123",
		targetFolder: "signals/",
		itemTypeFilter: [],
		conflictStrategy: "skip",
		lastSync: null,
		lastSyncItemCount: 0,
		status: "disconnected",
		...overrides,
	};
}

describe("SignalDiagnosticsService", () => {
	let adapter: SignalAdapter;
	let eventBus: IEventBus;
	let service: SignalDiagnosticsService;

	beforeEach(() => {
		adapter = createMockAdapter();
		eventBus = createMockEventBus();
		service = new SignalDiagnosticsService({ adapter, eventBus });
	});

	describe("checkHealth()", () => {
		it("returns diagnostics with latency on successful check", async () => {
			const config = createSignalConfig();
			const diag = await service.checkHealth(config);
			expect(diag.success).toBe(true);
			expect(diag.latencyMs).toBeGreaterThanOrEqual(0);
			expect(diag.checkedAt).toBeTruthy();
			expect(diag.apiVersion).toBeNull();
			expect(diag.scopes).toEqual([]);
		});

		it("records success in the health monitor", async () => {
			const config = createSignalConfig();
			await service.checkHealth(config);
			const health = service.getMonitor().getHealth("sig-1");
			expect(health.status).toBe("healthy");
			expect(health.consecutiveFailures).toBe(0);
		});

		it("records failure in the health monitor on adapter failure", async () => {
			adapter = createMockAdapter({ success: false, error: "Timeout" });
			service = new SignalDiagnosticsService({ adapter, eventBus });
			const config = createSignalConfig();
			await service.checkHealth(config);
			const health = service.getMonitor().getHealth("sig-1");
			expect(health.status).toBe("degraded");
			expect(health.consecutiveFailures).toBe(1);
		});

		it("records failure when adapter throws", async () => {
			adapter = {
				testConnection: vi.fn(async () => { throw new Error("Network down"); }),
				fetchItems: vi.fn(async () => ({ items: [], errors: [] })),
			};
			service = new SignalDiagnosticsService({ adapter, eventBus });
			const config = createSignalConfig();
			const diag = await service.checkHealth(config);
			expect(diag.success).toBe(false);
			expect(diag.error).toBe("Network down");
			const health = service.getMonitor().getHealth("sig-1");
			expect(health.status).toBe("degraded");
		});

		it("emits signal.health.checked event", async () => {
			const config = createSignalConfig();
			await service.checkHealth(config);
			expect(eventBus.emit).toHaveBeenCalledWith("signal.health.checked", expect.objectContaining({
				signalId: "sig-1",
				status: "healthy",
				success: true,
			}));
		});

		it("emits signal.health.changed on status transition", async () => {
			adapter = createMockAdapter({ success: false, error: "Timeout" });
			service = new SignalDiagnosticsService({ adapter, eventBus });
			const config = createSignalConfig();
			await service.checkHealth(config);
			expect(eventBus.emit).toHaveBeenCalledWith("signal.health.changed", {
				signalId: "sig-1",
				previousStatus: "unknown",
				newStatus: "degraded",
			});
		});

		it("does not emit signal.health.changed when status stays the same", async () => {
			const config = createSignalConfig();
			await service.checkHealth(config);
			(eventBus.emit as ReturnType<typeof vi.fn>).mockClear();
			await service.checkHealth(config);
			const changedCalls = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls
				.filter((call) => call[0] === "signal.health.changed");
			expect(changedCalls).toHaveLength(0);
		});

		it("tracks unreachable after 3 consecutive failures", async () => {
			adapter = createMockAdapter({ success: false, error: "Down" });
			service = new SignalDiagnosticsService({ adapter, eventBus });
			const config = createSignalConfig();
			await service.checkHealth(config);
			await service.checkHealth(config);
			await service.checkHealth(config);
			const health = service.getMonitor().getHealth("sig-1");
			expect(health.status).toBe("unreachable");
		});

		it("caches last diagnostics per signal", async () => {
			const config = createSignalConfig();
			await service.checkHealth(config);
			const snap = service.getDiagnostics("sig-1");
			expect(snap.lastDiagnostics).not.toBeNull();
			expect(snap.lastDiagnostics!.success).toBe(true);
		});
	});

	describe("getDiagnostics()", () => {
		it("returns unknown health and null diagnostics for unchecked signal", () => {
			const snap = service.getDiagnostics("sig-unknown");
			expect(snap.health.status).toBe("unknown");
			expect(snap.lastDiagnostics).toBeNull();
		});

		it("returns combined health and diagnostics after a check", async () => {
			const config = createSignalConfig();
			await service.checkHealth(config);
			const snap = service.getDiagnostics("sig-1");
			expect(snap.health.status).toBe("healthy");
			expect(snap.lastDiagnostics).toBeDefined();
			expect(snap.lastDiagnostics!.latencyMs).toBeGreaterThanOrEqual(0);
		});
	});

	describe("recordSuccess()", () => {
		it("delegates to the health monitor", () => {
			const state = service.recordSuccess("sig-1");
			expect(state.status).toBe("healthy");
		});
	});

	describe("recordFailure()", () => {
		it("delegates to the health monitor", () => {
			const state = service.recordFailure("sig-1", "oops");
			expect(state.status).toBe("degraded");
		});
	});

	describe("remove()", () => {
		it("removes health state and cached diagnostics", async () => {
			const config = createSignalConfig();
			await service.checkHealth(config);
			service.remove("sig-1");
			const snap = service.getDiagnostics("sig-1");
			expect(snap.health.status).toBe("unknown");
			expect(snap.lastDiagnostics).toBeNull();
		});
	});

	describe("dispose()", () => {
		it("clears all state", async () => {
			const config = createSignalConfig();
			await service.checkHealth(config);
			service.dispose();
			expect(service.getMonitor().getAllHealth()).toHaveLength(0);
			expect(service.getDiagnostics("sig-1").lastDiagnostics).toBeNull();
		});
	});
});
