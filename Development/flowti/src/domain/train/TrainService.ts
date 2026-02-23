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
	BranchStatus,
} from "./types";
import { MAX_TRAINS, MAX_THOUGHTS_PER_TRAIN } from "./types";
import { generateTrainSummary } from "./TrainSummaryWriter";

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

	/** Late-binding settings getter — overridden in main.ts after service load. */
	public getSettings: () => { trainFolder: string; trainMaxThoughts: number } = () => ({
		trainFolder: "",
		trainMaxThoughts: 100,
	});

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
			// Backward compat: compute folderPath for trains created before per-train folders
			for (const train of this.state.trains) {
				if (!train.folderPath) {
					train.folderPath = this.computeFolderPath(train.title, train.createdAt);
				}
			}
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
			void this.writeSummary(train);
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
	 * If another train is running or paused, it is auto-paused (nesting).
	 * @param durationMinutes Timer duration in minutes (0 = unlimited / no timer).
	 */
	async startTrain(title: string, durationMinutes = 0, trainType?: string): Promise<TrainState> {
		// Nesting: pause the active train before starting a new one
		const activeTrain = this.getActiveTrain();
		let parentTrainId: string | undefined;
		if (activeTrain) {
			if (activeTrain.status === "running") {
				await this.pause(activeTrain.id);
			}
			parentTrainId = activeTrain.id;
		}

		// Create session via event (avoids direct SessionService dependency)
		const sessionId = await this.createSessionViaEvent(title, durationMinutes);

		const createdAt = new Date().toISOString();
		const train: TrainState = {
			id: `train_${generateUUID()}`,
			sessionId,
			title,
			status: "running",
			thoughts: [],
			relations: [],
			durationMinutes,
			createdAt,
			pausedAt: null,
			completedAt: null,
			parentTrainId,
			folderPath: this.computeFolderPath(title, createdAt),
			trainType,
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
		const maxThoughts = Math.min(this.getSettings().trainMaxThoughts, MAX_THOUGHTS_PER_TRAIN);
		if (train.thoughts.length >= maxThoughts) return null;

		const direction: ThoughtDirection = options?.direction ?? "next";

		let thoughtPath: string;
		if (options?.path) {
			// Use existing file path (e.g., "Start new Train from this file")
			thoughtPath = options.path;
		} else {
			// Create note via CaptureService in the train's own subfolder
			// Prefix with compact ISO timestamp to avoid naming collisions
			const now = new Date();
			const ts = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15); // YYYYMMDD-HHmmss
			const fileTitle = `${ts} ${title}`;
			const folder = train.folderPath ?? "";
			const result = await this.captureService.capture({
				title: fileTitle,
				type: "thought",
				...(folder ? { folder } : {}),
			});
			thoughtPath = result.path;
		}

		const order = train.thoughts.length;
		const thought: ThoughtNode = {
			id: `thought_${generateUUID()}`,
			trainId,
			title,
			path: thoughtPath,
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
	 * If another train is running, it is auto-paused first (nesting).
	 */
	async resume(trainId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train || train.status !== "paused") return false;

		// Nesting: pause the currently running train before resuming this one
		const runningTrain = this.state.trains.find(
			(t) => t.id !== trainId && t.status === "running",
		);
		if (runningTrain) {
			await this.pause(runningTrain.id);
		}

		train.status = "running";
		train.pausedAt = null;
		await this.persist();

		void this.eventBus.emit("session.resume", { sessionId: train.sessionId });
		void this.eventBus.emit("train.resumed", { trainId });
		return true;
	}

	/**
	 * Complete a train — marks it as done so it no longer blocks new trains.
	 * Generates a summary document in the train folder.
	 */
	async completeTrain(trainId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train || train.status === "completed") return false;

		train.status = "completed";
		train.completedAt = new Date().toISOString();
		await this.persist();

		void this.eventBus.emit("session.complete", { sessionId: train.sessionId });
		void this.eventBus.emit("train.completed", { trainId, thoughtCount: train.thoughts.length });

		// Fire-and-forget summary generation
		void this.writeSummary(train);
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
	 * Rename a train. Updates state + folder path + thought paths.
	 * Emits oldFolder/newFolder so the caller (main.ts) can rename
	 * the vault folder via Obsidian API.
	 */
	async renameTrain(trainId: string, newTitle: string): Promise<boolean> {
		const trimmed = newTitle.trim();
		if (!trimmed) return false;

		const train = this.findTrain(trainId);
		if (!train) return false;
		if (train.title === trimmed) return false;

		const oldTitle = train.title;
		const oldFolder = train.folderPath ?? "";

		train.title = trimmed;
		const newFolder = this.computeFolderPath(trimmed, train.createdAt);
		train.folderPath = newFolder;

		// Update thought paths to reflect new folder
		if (oldFolder && newFolder !== oldFolder) {
			for (const thought of train.thoughts) {
				if (thought.path.startsWith(oldFolder + "/")) {
					thought.path = newFolder + thought.path.slice(oldFolder.length);
				}
			}
		}

		await this.persist();

		void this.eventBus.emit("train.renamed", { trainId, oldTitle, newTitle: trimmed, oldFolder, newFolder });
		return true;
	}

	/**
	 * Rename a thought. Updates title + computes new vault note path.
	 * Emits train.thought.renamed so the caller (main.ts) can rename
	 * the vault file via Obsidian API.
	 */
	async renameThought(trainId: string, thoughtId: string, newTitle: string): Promise<boolean> {
		const trimmed = newTitle.trim();
		if (!trimmed) return false;

		const train = this.findTrain(trainId);
		if (!train) return false;

		const thought = train.thoughts.find((t) => t.id === thoughtId);
		if (!thought) return false;
		if (thought.title === trimmed) return false;

		const oldTitle = thought.title;
		const oldPath = thought.path;

		// Update title
		thought.title = trimmed;

		// Compute new path: keep timestamp prefix, change title portion
		// Filename format: "YYYYMMDD-HHmmss OldTitle.md"
		const dir = oldPath.substring(0, oldPath.lastIndexOf("/"));
		const filename = oldPath.split("/").pop() ?? oldPath;
		const baseName = filename.replace(/\.md$/, "");
		const spaceIdx = baseName.indexOf(" ");
		const prefix = spaceIdx >= 0 ? baseName.substring(0, spaceIdx) : "";
		const safeTitle = trimmed.replace(/[\\/:*?"<>|]/g, "-");
		const newFileName = prefix ? `${prefix} ${safeTitle}.md` : `${safeTitle}.md`;
		const newPath = dir ? `${dir}/${newFileName}` : newFileName;

		thought.path = newPath;
		await this.persist();

		void this.eventBus.emit("train.thought.renamed", {
			trainId,
			thoughtId,
			oldTitle,
			newTitle: trimmed,
			oldPath,
			newPath,
		});

		return true;
	}

	/**
	 * Delete a train from history. Running trains cannot be deleted.
	 * Does NOT delete thought note files — they may be linked elsewhere.
	 */
	async deleteTrain(trainId: string): Promise<boolean> {
		const idx = this.state.trains.findIndex((t) => t.id === trainId);
		if (idx === -1) return false;

		const train = this.state.trains[idx];
		if (train.status === "running") return false;

		this.state.trains.splice(idx, 1);
		await this.persist();

		void this.eventBus.emit("train.deleted", { trainId, title: train.title });
		return true;
	}

	/**
	 * Set a branch status label on a thought.
	 * Only branch origin nodes (target of a "branch" relation) can be tagged.
	 */
	async setBranchStatus(trainId: string, thoughtId: string, status: BranchStatus): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train) return false;

		// Must be a branch origin (toId of a "branch" relation)
		const isBranchOrigin = train.relations.some(
			(r) => r.direction === "branch" && r.toId === thoughtId,
		);
		if (!isBranchOrigin) return false;

		const thought = train.thoughts.find((t) => t.id === thoughtId);
		if (!thought) return false;

		thought.branchStatus = status;
		await this.persist();
		void this.eventBus.emit("train.branch.status.changed", { trainId, thoughtId, status });
		return true;
	}

	/** Clear the branch status label from a thought. */
	async clearBranchStatus(trainId: string, thoughtId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train) return false;

		const thought = train.thoughts.find((t) => t.id === thoughtId);
		if (!thought || !thought.branchStatus) return false;

		delete thought.branchStatus;
		await this.persist();
		void this.eventBus.emit("train.branch.status.changed", { trainId, thoughtId, status: null });
		return true;
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

	/**
	 * Get the set of thought IDs that lie on the main chain.
	 * The main chain is the linear "next" path from root to head — the storyline backbone.
	 * Branch origins are on the main chain; branch children are not.
	 */
	getMainChainIds(trainId: string): Set<string> {
		const train = this.findTrain(trainId);
		if (!train) return new Set();
		return this.computeMainChainIds(train);
	}

	/**
	 * Get the head node (last main-chain thought) of a train.
	 * Returns null if the train has no thoughts.
	 */
	getHeadNode(trainId: string): ThoughtNode | null {
		const timeline = this.getTimeline(trainId);
		return timeline.length > 0 ? timeline[timeline.length - 1] : null;
	}

	// ── Merge ───────────────────────────────────────────────────

	/**
	 * Find the merge-down info for a branch thought.
	 *
	 * Algorithm:
	 * 1. Reject if source is on the main chain (only branch nodes can merge down).
	 * 2. Walk backward through parent relations. At each "branch" edge, the
	 *    parent is a branch origin — check if it has a "next" child.
	 * 3. If yes, that "next" child is the merge-down target (merge to parent chain).
	 * 4. If no, return the branch origin as the merge point (new thought will be
	 *    created as "next" from the origin).
	 *
	 * @returns `{ targetId, originId }` where targetId is the existing merge target
	 *          (or null if origin has no next), and originId is the branch origin.
	 *          Returns null if source is not on a branch.
	 */
	findMergeDownTarget(trainId: string, sourceId: string): { targetId: string | null; originId: string } | null {
		const train = this.findTrain(trainId);
		if (!train) return null;

		// Source must exist
		if (!train.thoughts.some((t) => t.id === sourceId)) return null;

		// Build reverse adjacency: childId → { parentId, direction }
		const parentMap = new Map<string, { parentId: string; direction: string }>();
		for (const r of train.relations) {
			if (r.direction === "next" || r.direction === "branch") {
				parentMap.set(r.toId, { parentId: r.fromId, direction: r.direction });
			}
		}

		// Build forward "next" map for finding the target after each branch origin
		const nextMap = new Map<string, string>();
		for (const r of train.relations) {
			if (r.direction === "next") {
				nextMap.set(r.fromId, r.toId);
			}
		}

		// Check if branch is already merged: walk forward from source through "next"
		// edges — if any node is already the source of a merge relation, branch is merged
		const mergedSources = new Set<string>();
		for (const r of train.relations) {
			if (r.direction === "merge") mergedSources.add(r.fromId);
		}
		let fwd = sourceId;
		const fwdVisited = new Set<string>();
		while (fwd) {
			if (fwdVisited.has(fwd)) break;
			fwdVisited.add(fwd);
			if (mergedSources.has(fwd)) return null; // Already merged
			fwd = nextMap.get(fwd) ?? "";
		}

		let current = sourceId;
		const visited = new Set<string>();
		while (current) {
			if (visited.has(current)) return null; // Cycle protection
			visited.add(current);

			const parent = parentMap.get(current);
			if (!parent) return null; // Reached root without finding a branch edge

			if (parent.direction === "branch") {
				// Found a branch point — check if origin has a "next" child
				const nextId = nextMap.get(parent.parentId);
				return { targetId: nextId ?? null, originId: parent.parentId };
			}

			current = parent.parentId;
		}
		return null;
	}

	/**
	 * Merge a branch thought into a target thought.
	 * Creates a structural "merge" relation — no content is modified.
	 * Train must be running or paused.
	 * Rejects: self-merge, duplicates, cycles, and main-chain sources.
	 * Only branch descendants can be merge sources — main chain nodes are protected.
	 */
	async mergeBranch(trainId: string, sourceId: string, targetId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train || train.status === "completed") return false;

		// Both thoughts must exist
		const source = train.thoughts.find((t) => t.id === sourceId);
		const target = train.thoughts.find((t) => t.id === targetId);
		if (!source || !target) return false;

		// No self-merge
		if (sourceId === targetId) return false;

		// Main chain protection: source must NOT be on the main chain
		if (this.computeMainChainIds(train).has(sourceId)) return false;

		// No duplicate merge
		const duplicate = train.relations.find(
			(r) => r.fromId === sourceId && r.toId === targetId && r.direction === "merge",
		);
		if (duplicate) return false;

		// No cycles — target must not be reachable from source via forward edges
		if (this.isReachable(train, sourceId, targetId)) return false;

		const relation: ThoughtRelation = {
			fromId: sourceId,
			toId: targetId,
			direction: "merge",
		};
		train.relations.push(relation);
		await this.persist();

		// Fire-and-forget frontmatter update
		void this.updateMergeFrontmatter(source, target, train);

		void this.eventBus.emit("train.branch.merged", { trainId, sourceId, targetId });
		return true;
	}

	/**
	 * Undo a merge — remove the merge relation between source and target.
	 */
	async undoMerge(trainId: string, sourceId: string, targetId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train) return false;

		const idx = train.relations.findIndex(
			(r) => r.fromId === sourceId && r.toId === targetId && r.direction === "merge",
		);
		if (idx === -1) return false;

		train.relations.splice(idx, 1);
		await this.persist();

		// Fire-and-forget frontmatter update
		const source = train.thoughts.find((t) => t.id === sourceId);
		if (source) {
			void this.fileSystem.updateFrontmatter(source.path, {
				...this.buildNavLinks(train, sourceId),
			});
		}

		void this.eventBus.emit("train.branch.merge.undone", { trainId, sourceId, targetId });
		return true;
	}

	/**
	 * Get all merge relations for a train.
	 */
	getMerges(trainId: string): ThoughtRelation[] {
		const train = this.findTrain(trainId);
		if (!train) return [];
		return train.relations.filter((r) => r.direction === "merge");
	}

	// ── Private helpers ──────────────────────────────────────────

	private findTrain(trainId: string): TrainState | undefined {
		return this.state.trains.find((t) => t.id === trainId);
	}

	/**
	 * Compute a per-train subfolder path from the train title and creation timestamp.
	 * Format: `{trainFolder}/{YYYYMMDD-HHmm} {safeTitle}`
	 */
	private computeFolderPath(title: string, createdAt: string): string {
		const ts = createdAt.replace(/[-:]/g, "").replace("T", "-").slice(0, 13); // YYYYMMDD-HHmm
		const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-");
		const { trainFolder } = this.getSettings();
		return trainFolder ? `${trainFolder}/${ts} ${safeTitle}` : `${ts} ${safeTitle}`;
	}

	/**
	 * Check if targetId is reachable from sourceId via forward edges (next/branch).
	 * Merge edges are NOT followed — they represent convergence, not forward flow.
	 */
	/**
	 * Compute the set of thought IDs on the main chain (root → head via "next" edges).
	 * Branch origins are on the main chain; branch children are not.
	 */
	private computeMainChainIds(train: TrainState): Set<string> {
		if (train.thoughts.length === 0) return new Set();

		const nextMap = new Map<string, string>();
		const incomingNext = new Set<string>();
		for (const r of train.relations) {
			if (r.direction === "next") {
				nextMap.set(r.fromId, r.toId);
				incomingNext.add(r.toId);
			}
		}

		const root = train.thoughts.find((t) => !incomingNext.has(t.id)) ?? train.thoughts[0];
		const mainIds = new Set<string>([root.id]);
		let current = root.id;
		while (nextMap.has(current)) {
			current = nextMap.get(current)!;
			mainIds.add(current);
		}
		return mainIds;
	}

	private isReachable(train: TrainState, sourceId: string, targetId: string): boolean {
		const visited = new Set<string>();
		const stack = [sourceId];

		// Build adjacency: fromId → [toId] for next/branch only
		const adj = new Map<string, string[]>();
		for (const r of train.relations) {
			if (r.direction === "next" || r.direction === "branch") {
				const list = adj.get(r.fromId) ?? [];
				list.push(r.toId);
				adj.set(r.fromId, list);
			}
		}

		while (stack.length > 0) {
			const current = stack.pop()!;
			if (current === targetId) return true;
			if (visited.has(current)) continue;
			visited.add(current);
			for (const neighbor of adj.get(current) ?? []) {
				stack.push(neighbor);
			}
		}
		return false;
	}

	/**
	 * Update frontmatter for both source and target after a merge.
	 */
	private async updateMergeFrontmatter(
		source: ThoughtNode,
		target: ThoughtNode,
		train: TrainState,
	): Promise<void> {
		await this.fileSystem.updateFrontmatter(source.path, {
			...this.buildNavLinks(train, source.id),
		});
		await this.fileSystem.updateFrontmatter(target.path, {
			...this.buildNavLinks(train, target.id),
		});
	}

	/**
	 * Generate and write a summary document for a completed train.
	 */
	private async writeSummary(train: TrainState): Promise<void> {
		if (train.thoughts.length === 0) return;

		const markdown = generateTrainSummary(train);
		const folder = train.folderPath ?? "";
		const fileName = `${train.title} — Summary`;
		const summaryPath = folder ? `${folder}/${fileName}.md` : `${fileName}.md`;

		await this.fileSystem.createFile(summaryPath, markdown);
		void this.eventBus.emit("train.summary.created", { trainId: train.id, summaryPath });
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
	 * Enrich thought note frontmatter with navigation links.
	 *
	 * Navigation model (compass):
	 *   next  — linear forward  (children with direction="next")
	 *   prev  — linear backward (parent with direction="next")
	 *   up    — branch children (children with direction="branch")
	 *   down  — branch parent   (parent with direction="branch")
	 *
	 * Each property is a list of wikilinks, rebuilt from the full relation graph.
	 */
	private async updateThoughtFrontmatter(
		thought: ThoughtNode,
		train: TrainState,
		fromThought: ThoughtNode | null,
		_direction: ThoughtDirection,
	): Promise<void> {
		// Update the new thought's frontmatter
		await this.fileSystem.updateFrontmatter(thought.path, {
			"train-session": train.title,
			"thought-order": thought.order,
			...this.buildNavLinks(train, thought.id),
		});

		// Update the source thought's frontmatter (its nav links changed)
		if (fromThought) {
			await this.fileSystem.updateFrontmatter(fromThought.path, {
				...this.buildNavLinks(train, fromThought.id),
			});
		}
	}

	/**
	 * Build the navigation wikilink lists for a thought from the train's relations.
	 * Uses file basename (from path) for wikilinks — not thought.title — because
	 * file names include an ISO timestamp prefix that titles lack.
	 */
	private buildNavLinks(
		train: TrainState,
		thoughtId: string,
	): Record<string, string[]> {
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		const next: string[] = [];
		const prev: string[] = [];
		const up: string[] = [];
		const down: string[] = [];
		const mergeTarget: string[] = [];
		const mergedFrom: string[] = [];

		for (const r of train.relations) {
			if (r.fromId === thoughtId) {
				const child = thoughtById.get(r.toId);
				if (!child) continue;
				const link = `[[${this.basenameFromPath(child.path)}]]`;
				if (r.direction === "next") next.push(link);
				else if (r.direction === "branch") up.push(link);
				else if (r.direction === "merge") mergeTarget.push(link);
			} else if (r.toId === thoughtId) {
				const parent = thoughtById.get(r.fromId);
				if (!parent) continue;
				const link = `[[${this.basenameFromPath(parent.path)}]]`;
				if (r.direction === "next") prev.push(link);
				else if (r.direction === "branch") down.push(link);
				else if (r.direction === "merge") mergedFrom.push(link);
			}
		}

		return { next, prev, up, down, "merge-target": mergeTarget, "merged-from": mergedFrom };
	}

	/** Extract file basename without extension from a vault path. */
	private basenameFromPath(path: string): string {
		const filename = path.split("/").pop() ?? path;
		return filename.replace(/\.md$/, "");
	}
}
