/**
 * TrainService — Manages Train of Thoughts serial capture sessions.
 *
 * Creates a session + trains. Each thought creates a linked vault note
 * via CaptureService, with frontmatter linking previous/next thoughts.
 *
 * Stateful service: persists TrainServiceState via TypedStorage.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type { CaptureService } from "../capture/CaptureService";
import type { Session } from "../session/types";
import { generateUUID } from "../../utils/helpers";
import type {
	TrainState,
	TrainServiceState,
	ThoughtNode,
	ThoughtRelation,
} from "./types";
import { MAX_TRAINS, MAX_THOUGHTS_PER_TRAIN } from "./types";

export interface TrainServiceOptions {
	storage: ITypedStorage<TrainServiceState>;
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
	captureService: CaptureService;
}

export class TrainService {
	private readonly storage: ITypedStorage<TrainServiceState>;
	private readonly eventBus: IEventBus;
	private readonly fileSystem: IFileSystemClient;
	private readonly captureService: CaptureService;
	private state: TrainServiceState = { trains: [] };

	constructor(options: TrainServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;
		this.captureService = options.captureService;
	}

	async load(): Promise<void> {
		const persisted = await this.storage.safeLoad();
		if (persisted) {
			this.state = persisted;
		}
	}

	/**
	 * Start a new train: create a session via EventBus, then create the TrainState.
	 */
	async startTrain(title: string): Promise<TrainState> {
		// Create session via event (avoids direct SessionService dependency)
		const sessionId = await this.createSessionViaEvent(title);

		const train: TrainState = {
			id: `train_${generateUUID()}`,
			sessionId,
			title,
			status: "running",
			thoughts: [],
			relations: [],
			createdAt: new Date().toISOString(),
			pausedAt: null,
			completedAt: null,
		};

		// Evict oldest if at capacity
		if (this.state.trains.length >= MAX_TRAINS) {
			this.state.trains.shift();
		}

		this.state.trains.push(train);
		await this.persist();

		// Start the session timer
		void this.eventBus.emit("session.start", { sessionId });

		void this.eventBus.emit("train.started", { train });
		return train;
	}

	/**
	 * Add a thought to a running train.
	 */
	async addThought(trainId: string, title: string): Promise<ThoughtNode | null> {
		const train = this.findTrain(trainId);
		if (!train || train.status !== "running") return null;
		if (train.thoughts.length >= MAX_THOUGHTS_PER_TRAIN) return null;

		// Create note via CaptureService
		const result = await this.captureService.capture({
			title,
			type: "thought",
		});

		const order = train.thoughts.length;
		const thought: ThoughtNode = {
			id: `thought_${generateUUID()}`,
			trainId,
			title,
			path: result.path,
			createdAt: new Date().toISOString(),
			order,
		};

		const previousThought = train.thoughts[order - 1] ?? null;

		// Link to previous thought
		if (previousThought) {
			const relation: ThoughtRelation = {
				fromId: previousThought.id,
				toId: thought.id,
				type: "next",
			};
			train.relations.push(relation);
		}

		train.thoughts.push(thought);
		await this.persist();

		// Fire-and-forget frontmatter enrichment
		void this.updateThoughtFrontmatter(thought, train, previousThought);

		void this.eventBus.emit("train.thought.added", {
			trainId,
			thought,
			previousTitle: previousThought?.title ?? null,
		});

		return thought;
	}

	/**
	 * Pause a running train.
	 */
	async pause(trainId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train || train.status !== "running") return false;

		train.status = "paused";
		train.pausedAt = new Date().toISOString();
		await this.persist();

		void this.eventBus.emit("session.pause", { sessionId: train.sessionId });
		void this.eventBus.emit("train.paused", { trainId });
		return true;
	}

	/**
	 * Resume a paused train.
	 */
	async resume(trainId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train || train.status !== "paused") return false;

		train.status = "running";
		train.pausedAt = null;
		await this.persist();

		void this.eventBus.emit("session.resume", { sessionId: train.sessionId });
		void this.eventBus.emit("train.resumed", { trainId });
		return true;
	}

	getTrain(trainId: string): TrainState | undefined {
		return this.findTrain(trainId);
	}

	getActiveTrain(): TrainState | undefined {
		return this.state.trains.find((t) => t.status === "running" || t.status === "paused");
	}

	getAllTrains(): readonly TrainState[] {
		return this.state.trains;
	}

	// ── Private helpers ──────────────────────────────────────────

	private findTrain(trainId: string): TrainState | undefined {
		return this.state.trains.find((t) => t.id === trainId);
	}

	private async persist(): Promise<void> {
		await this.storage.safeSave(this.state);
	}

	/**
	 * Create a session via EventBus and wait for the session.created response.
	 * Times out after 5 seconds to avoid hanging if SessionService is unavailable.
	 */
	private createSessionViaEvent(title: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const timeout = setTimeout(() => {
				unsub();
				reject(new Error("Timeout waiting for session.created"));
			}, 5000);

			const unsub = this.eventBus.on("session.created", (event) => {
				clearTimeout(timeout);
				unsub();
				resolve((event.payload as { session: Session }).session.id);
			});

			void this.eventBus.emit("session.create", {
				type: "train-of-thought" as const,
				title: `Train: ${title}`,
				durationMinutes: 0,
			});
		});
	}

	/**
	 * Enrich thought note frontmatter with train context and links.
	 */
	private async updateThoughtFrontmatter(
		thought: ThoughtNode,
		train: TrainState,
		previousThought: ThoughtNode | null,
	): Promise<void> {
		const data: Record<string, unknown> = {
			"train-session": train.title,
			"thought-order": thought.order,
		};

		if (previousThought) {
			data["previous-thought"] = `[[${previousThought.title}]]`;
		}

		await this.fileSystem.updateFrontmatter(thought.path, data);

		// Update previous thought with next-thought link
		if (previousThought) {
			await this.fileSystem.updateFrontmatter(previousThought.path, {
				"next-thought": `[[${thought.title}]]`,
			});
		}
	}
}
