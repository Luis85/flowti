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
	AddThoughtOptions,
	ThoughtDirection,
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
		this.setupListeners();
	}

	/**
	 * Sync train lifecycle with session lifecycle events.
	 *
	 * Sessions can be resumed/completed externally (Session Workspace, timer
	 * expiry, User Hub). Without these listeners the train would get stuck
	 * in a stale state.
	 */
	private setupListeners(): void {
		// Session completed externally → auto-complete the linked train
		this.eventBus.on("session.completed", (event) => {
			const session = event.payload.session;
			const train = this.state.trains.find(
				(t) => t.sessionId === session.id && t.status !== "completed",
			);
			if (!train) return;

			train.status = "completed";
			train.completedAt = new Date().toISOString();
			void this.persist();
			void this.eventBus.emit("train.completed", {
				trainId: train.id,
				thoughtCount: train.thoughts.length,
			});
		});

		// Session resumed externally → auto-resume the linked train
		this.eventBus.on("session.resumed", (event) => {
			const session = event.payload.session;
			const train = this.state.trains.find(
				(t) => t.sessionId === session.id && t.status === "paused",
			);
			if (!train) return;

			train.status = "running";
			train.pausedAt = null;
			void this.persist();
			void this.eventBus.emit("train.resumed", { trainId: train.id });
		});

		// Session paused externally → auto-pause the linked train
		this.eventBus.on("session.paused", (event) => {
			const session = event.payload.session;
			const train = this.state.trains.find(
				(t) => t.sessionId === session.id && t.status === "running",
			);
			if (!train) return;

			train.status = "paused";
			train.pausedAt = new Date().toISOString();
			void this.persist();
			void this.eventBus.emit("train.paused", { trainId: train.id });
		});
	}

	/**
	 * Start a new train: create a session via EventBus, then create the TrainState.
	 * @param durationMinutes Timer duration in minutes (0 = unlimited / no timer).
	 */
	async startTrain(title: string, durationMinutes = 0): Promise<TrainState> {
		// Create session via event (avoids direct SessionService dependency)
		const sessionId = await this.createSessionViaEvent(title, durationMinutes);

		const train: TrainState = {
			id: `train_${generateUUID()}`,
			sessionId,
			title,
			status: "running",
			thoughts: [],
			relations: [],
			durationMinutes,
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
	async addThought(
		trainId: string,
		title: string,
		options?: AddThoughtOptions,
	): Promise<ThoughtNode | null> {
		const train = this.findTrain(trainId);
		if (!train || train.status !== "running") return null;
		if (train.thoughts.length >= MAX_THOUGHTS_PER_TRAIN) return null;

		const direction: ThoughtDirection = options?.direction ?? "next";

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

		// Determine source thought for linking
		const fromThought = options?.fromThoughtId
			? train.thoughts.find((t) => t.id === options.fromThoughtId) ?? null
			: train.thoughts[order - 1] ?? null;

		// Create relation
		if (fromThought) {
			const relation: ThoughtRelation = {
				fromId: fromThought.id,
				toId: thought.id,
				direction,
			};
			train.relations.push(relation);
		}

		train.thoughts.push(thought);
		await this.persist();

		// Fire-and-forget frontmatter enrichment
		void this.updateThoughtFrontmatter(thought, train, fromThought, direction);

		void this.eventBus.emit("train.thought.added", {
			trainId,
			thought,
			previousTitle: fromThought?.title ?? null,
			direction,
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

	/**
	 * Complete a train — marks it as done so it no longer blocks new trains.
	 */
	async completeTrain(trainId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train || train.status === "completed") return false;

		train.status = "completed";
		train.completedAt = new Date().toISOString();
		await this.persist();

		void this.eventBus.emit("session.complete", { sessionId: train.sessionId });
		void this.eventBus.emit("train.completed", { trainId, thoughtCount: train.thoughts.length });
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

	/**
	 * Get the main timeline — follows "next" chain from the first thought.
	 */
	getTimeline(trainId: string): ThoughtNode[] {
		const train = this.findTrain(trainId);
		if (!train || train.thoughts.length === 0) return [];

		// Find root: the thought that has no incoming "next" relation
		const incomingNext = new Set(
			train.relations.filter((r) => r.direction === "next").map((r) => r.toId),
		);
		const root = train.thoughts.find((t) => !incomingNext.has(t.id)) ?? train.thoughts[0];

		// Build lookup: fromId → child thought with direction "next"
		const nextMap = new Map<string, string>();
		for (const r of train.relations) {
			if (r.direction === "next") {
				nextMap.set(r.fromId, r.toId);
			}
		}

		// Walk the chain
		const timeline: ThoughtNode[] = [root];
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		let currentId = root.id;
		while (nextMap.has(currentId)) {
			const nextId = nextMap.get(currentId)!;
			const next = thoughtById.get(nextId);
			if (!next) break;
			timeline.push(next);
			currentId = nextId;
		}

		return timeline;
	}

	/**
	 * Get branch children of a thought (direction = "branch").
	 */
	getBranches(trainId: string, thoughtId: string): ThoughtNode[] {
		const train = this.findTrain(trainId);
		if (!train) return [];

		const branchIds = train.relations
			.filter((r) => r.fromId === thoughtId && r.direction === "branch")
			.map((r) => r.toId);

		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		return branchIds.map((id) => thoughtById.get(id)).filter(Boolean) as ThoughtNode[];
	}

	/**
	 * Get all children of a thought (any direction).
	 */
	getChildren(trainId: string, thoughtId: string): ThoughtNode[] {
		const train = this.findTrain(trainId);
		if (!train) return [];

		const childIds = train.relations
			.filter((r) => r.fromId === thoughtId)
			.map((r) => r.toId);

		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		return childIds.map((id) => thoughtById.get(id)).filter(Boolean) as ThoughtNode[];
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
	private createSessionViaEvent(title: string, durationMinutes: number): Promise<string> {
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
				durationMinutes,
			});
		});
	}

	/**
	 * Enrich thought note frontmatter with train context and links.
	 */
	private async updateThoughtFrontmatter(
		thought: ThoughtNode,
		train: TrainState,
		fromThought: ThoughtNode | null,
		direction: ThoughtDirection,
	): Promise<void> {
		const data: Record<string, unknown> = {
			"train-session": train.title,
			"thought-order": thought.order,
		};

		if (fromThought) {
			data["previous-thought"] = `[[${fromThought.title}]]`;
			data["thought-relations"] = [
				{ target: `[[${fromThought.title}]]`, direction, role: "parent" },
			];
		}

		await this.fileSystem.updateFrontmatter(thought.path, data);

		// Update source thought with forward link + structured relations
		if (fromThought) {
			const existingRelations = this.buildExistingRelations(train, fromThought.id);
			existingRelations.push({
				target: `[[${thought.title}]]`,
				direction,
				role: "child",
			});

			await this.fileSystem.updateFrontmatter(fromThought.path, {
				"next-thought": `[[${thought.title}]]`,
				"thought-relations": existingRelations,
			});
		}
	}

	/**
	 * Build the thought-relations array for a thought's frontmatter.
	 */
	private buildExistingRelations(
		train: TrainState,
		thoughtId: string,
	): Array<{ target: string; direction: string; role: string }> {
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		const relations: Array<{ target: string; direction: string; role: string }> = [];

		for (const r of train.relations) {
			if (r.fromId === thoughtId) {
				const child = thoughtById.get(r.toId);
				if (child) {
					relations.push({
						target: `[[${child.title}]]`,
						direction: r.direction,
						role: "child",
					});
				}
			} else if (r.toId === thoughtId) {
				const parent = thoughtById.get(r.fromId);
				if (parent) {
					relations.push({
						target: `[[${parent.title}]]`,
						direction: r.direction,
						role: "parent",
					});
				}
			}
		}

		return relations;
	}
}
