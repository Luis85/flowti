/**
 * Signal domain service — manages external data source connections.
 *
 * Provides CRUD for signal configurations and sync orchestration
 * (fetch → map → create/update notes → progress → result).
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type { ISecretStore } from "../../utils/SecretStore";
import type { SignalConfig, SignalState, SyncResult, SyncError } from "./types";
import type { SignalAdapter, TestConnectionResult } from "./adapters/SignalAdapter";
import { writeWorkItemNote } from "./mappers/workItemNoteMapper";

export interface SignalServiceOptions {
	storage: ITypedStorage<SignalState>;
	secretStore: ISecretStore;
	eventBus?: IEventBus;
	adapter?: SignalAdapter;
	fileSystem?: IFileSystemClient;
}

/** Input for creating a new signal — system-managed fields are omitted. */
export type SignalConfigInput = Omit<
	SignalConfig,
	"id" | "lastSync" | "lastSyncItemCount" | "status"
>;

function createDefaultState(): SignalState {
	return { signals: [] };
}

function generateId(): string {
	return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** SecretStorage key for a signal's PAT. Lowercase alphanumeric + dashes per Obsidian API. */
function secretKey(signalId: string): string {
	return `signal-pat-${signalId.replace(/_/g, "-")}`;
}

export class SignalService {
	private state: SignalState = createDefaultState();
	private storage: ITypedStorage<SignalState>;
	private eventBus?: IEventBus;
	private adapter?: SignalAdapter;
	private fileSystem?: IFileSystemClient;
	private secretStore: ISecretStore;
	private unsubscribes: (() => void)[] = [];

	constructor(options: SignalServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.adapter = options.adapter;
		this.fileSystem = options.fileSystem;
		this.secretStore = options.secretStore;
	}

	// ── Lifecycle ────────────────────────────────────────────

	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.state = saved;
		}

		// Hydrate PATs from SecretStorage into in-memory state.
		// If a PAT is still in data.json (pre-migration), migrate it to SecretStorage.
		let needsMigration = false;
		for (const signal of this.state.signals) {
			const secretPat = this.secretStore.getSecret(secretKey(signal.id));
			if (secretPat) {
				signal.pat = secretPat;
			} else if (signal.pat) {
				// Legacy: PAT still in data.json — migrate to SecretStorage
				needsMigration = true;
			}
		}
		if (needsMigration) {
			await this.saveState();
		}

		await this.eventBus?.emit("signal.loaded", {
			signalCount: this.state.signals.length,
		});
	}

	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	// ── Queries ──────────────────────────────────────────────

	getSignals(): SignalConfig[] {
		return [...this.state.signals];
	}

	getSignal(id: string): SignalConfig | undefined {
		return this.state.signals.find((s) => s.id === id);
	}

	// ── Commands ─────────────────────────────────────────────

	async configure(input: SignalConfigInput): Promise<SignalConfig> {
		const config: SignalConfig = {
			...input,
			id: generateId(),
			lastSync: null,
			lastSyncItemCount: 0,
			status: "disconnected",
		};

		this.state.signals.push(config);
		await this.saveState();

		await this.eventBus?.emit("signal.configured", {
			signalId: config.id,
			name: config.name,
			type: config.type,
			project: config.project,
		});

		return config;
	}

	async update(
		id: string,
		partial: Partial<Omit<SignalConfig, "id">>,
	): Promise<SignalConfig | undefined> {
		const idx = this.state.signals.findIndex((s) => s.id === id);
		if (idx === -1) return undefined;

		const updated = { ...this.state.signals[idx], ...partial };
		this.state.signals[idx] = updated;
		await this.saveState();

		await this.eventBus?.emit("signal.configured", {
			signalId: updated.id,
			name: updated.name,
			type: updated.type,
			project: updated.project,
		});

		return updated;
	}

	async remove(id: string): Promise<boolean> {
		const signal = this.state.signals.find((s) => s.id === id);
		if (!signal) return false;

		this.state.signals = this.state.signals.filter((s) => s.id !== id);
		this.secretStore.deleteSecret(secretKey(id));
		await this.saveState();

		await this.eventBus?.emit("signal.removed", {
			signalId: id,
			name: signal.name,
		});

		return true;
	}

	// ── Sync orchestration ──────────────────────────────────

	async testConnection(signalId: string): Promise<TestConnectionResult> {
		const config = this.state.signals.find((s) => s.id === signalId);
		if (!config) return { success: false, error: "Signal not found" };
		if (!this.adapter) return { success: false, error: "No adapter configured" };

		const result = await this.adapter.testConnection(config);

		const idx = this.state.signals.findIndex((s) => s.id === signalId);
		if (idx !== -1) {
			this.state.signals[idx] = {
				...this.state.signals[idx],
				status: result.success ? "connected" : "error",
			};
			await this.saveState();
		}

		await this.eventBus?.emit("signal.connection.tested", {
			signalId,
			success: result.success,
			error: result.error,
		});

		return result;
	}

	async sync(signalId: string): Promise<SyncResult> {
		const config = this.state.signals.find((s) => s.id === signalId);
		if (!config || !this.adapter || !this.fileSystem) {
			const error = !config ? "Signal not found" : "Adapter or file system not configured";
			await this.eventBus?.emit("signal.sync.failed", { signalId, error });
			return { signalId, itemsCreated: 0, itemsUpdated: 0, itemsSkipped: 0, errors: [], duration: 0, timestamp: new Date().toISOString() };
		}

		const start = Date.now();
		await this.eventBus?.emit("signal.sync.started", { signalId, name: config.name });

		let fetchResult;
		try {
			fetchResult = await this.adapter.fetchItems(config);
		} catch (err: unknown) {
			const error = err instanceof Error ? err.message : "Fetch failed";
			await this.eventBus?.emit("signal.sync.failed", { signalId, error });
			return { signalId, itemsCreated: 0, itemsUpdated: 0, itemsSkipped: 0, errors: [], duration: Date.now() - start, timestamp: new Date().toISOString() };
		}

		const errors: SyncError[] = [...fetchResult.errors];
		let itemsCreated = 0;
		let itemsUpdated = 0;
		let itemsSkipped = 0;
		const total = fetchResult.items.length;

		for (let i = 0; i < fetchResult.items.length; i++) {
			const item = fetchResult.items[i];
			try {
				const writeResult = await writeWorkItemNote(item, config, this.fileSystem);
				switch (writeResult.action) {
					case "created":
						itemsCreated++;
						await this.eventBus?.emit("signal.item.created", { signalId, workItemId: item.id, notePath: writeResult.path });
						break;
					case "updated":
						itemsUpdated++;
						await this.eventBus?.emit("signal.item.updated", { signalId, workItemId: item.id, notePath: writeResult.path, fields: [] });
						break;
					case "skipped":
						itemsSkipped++;
						break;
				}
			} catch (err: unknown) {
				errors.push({
					workItemId: item.id,
					message: err instanceof Error ? err.message : "Write failed",
					recoverable: true,
				});
			}
			await this.eventBus?.emit("signal.sync.progress", { signalId, current: i + 1, total });
		}

		const syncResult: SyncResult = {
			signalId,
			itemsCreated,
			itemsUpdated,
			itemsSkipped,
			errors,
			duration: Date.now() - start,
			timestamp: new Date().toISOString(),
		};

		const idx = this.state.signals.findIndex((s) => s.id === signalId);
		if (idx !== -1) {
			this.state.signals[idx] = {
				...this.state.signals[idx],
				lastSync: syncResult.timestamp,
				lastSyncItemCount: itemsCreated + itemsUpdated + itemsSkipped,
				status: "connected",
			};
			await this.saveState();
		}

		await this.eventBus?.emit("signal.sync.completed", { signalId, result: syncResult });
		return syncResult;
	}

	async syncAll(): Promise<SyncResult[]> {
		const results: SyncResult[] = [];
		for (const signal of this.state.signals) {
			results.push(await this.sync(signal.id));
		}
		return results;
	}

	// ── Private ──────────────────────────────────────────────

	private async saveState(): Promise<void> {
		// Store PATs in SecretStorage; persist signal configs without PATs
		for (const signal of this.state.signals) {
			if (signal.pat) {
				this.secretStore.setSecret(secretKey(signal.id), signal.pat);
			}
		}
		const stripped = this.state.signals.map((s) => ({ ...s, pat: "" }));
		await this.storage.save({ signals: stripped });
	}
}
