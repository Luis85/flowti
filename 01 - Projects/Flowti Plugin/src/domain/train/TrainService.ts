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
import { registerTrainEventHandlers } from "./handlers/train-event-handlers";
import { isBranchAlreadyMerged, computeMainChainIds, isReachable, buildNavLinks } from "./TrainService-helpers";

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
	 * Delegated to train-event-handlers module — keeps this class lean.
	 */
	private setupListeners(): void {
		registerTrainEventHandlers({
			trains: () => this.state.trains,
			findBySessionId: (sid) => this.state.trains.find((t) => t.sessionId === sid),
			persist: () => this.persist(),
			writeSummary: (train) => this.writeSummary(train),
			eventBus: this.eventBus,
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
	/** Create a thought note file, either from a provided path or via CaptureService. */
	private async resolveThoughtPath(train: TrainState, title: string, options?: AddThoughtOptions): Promise<string> {
		if (options?.path) return options.path;
		const now = new Date();
		const ts = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
		const folder = train.folderPath ?? "";
		const result = await this.captureService.capture({
			title: `${ts} ${title}`,
			type: "thought",
			...(folder ? { folder } : {}),
		});
		return result.path;
	}

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
		const thoughtPath = await this.resolveThoughtPath(train, title, options);
		const order = train.thoughts.length;

		const thought: ThoughtNode = {
			id: `thought_${generateUUID()}`, trainId, title,
			path: thoughtPath, createdAt: new Date().toISOString(), order,
		};

		const fromThought = options?.fromThoughtId
			? train.thoughts.find((t) => t.id === options.fromThoughtId) ?? null
			: train.thoughts[order - 1] ?? null;

		if (fromThought) {
			train.relations.push({ fromId: fromThought.id, toId: thought.id, direction });
		}

		train.thoughts.push(thought);
		await this.persist();

		void this.updateThoughtFrontmatter(thought, train, fromThought, direction);
		void this.eventBus.emit("train.thought.added", {
			trainId, thought, previousTitle: fromThought?.title ?? null, direction,
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

	/** Delete a train from history. Running trains cannot be deleted. */
	async deleteTrain(trainId: string): Promise<boolean> {
		const idx = this.state.trains.findIndex((t) => t.id === trainId);
		if (idx === -1) return false;
		if (this.state.trains[idx].status === "running") return false;
		const title = this.state.trains[idx].title;
		this.state.trains.splice(idx, 1);
		await this.persist();
		void this.eventBus.emit("train.deleted", { trainId, title });
		return true;
	}

	/**
	 * Set a branch status label on a thought.
	 * Only branch origin nodes (target of a "branch" relation) can be tagged.
	 */
	async setBranchStatus(trainId: string, thoughtId: string, status: BranchStatus): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train) return false;
		if (!train.relations.some((r) => r.direction === "branch" && r.toId === thoughtId)) return false;
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

	/** Get the main timeline — follows "next" chain from the first thought. */
	getTimeline(trainId: string): ThoughtNode[] {
		const train = this.findTrain(trainId);
		if (!train || train.thoughts.length === 0) return [];
		const incomingNext = new Set(train.relations.filter((r) => r.direction === "next").map((r) => r.toId));
		const root = train.thoughts.find((t) => !incomingNext.has(t.id)) ?? train.thoughts[0];
		const nextMap = new Map<string, string>();
		for (const r of train.relations) { if (r.direction === "next") nextMap.set(r.fromId, r.toId); }
		const timeline: ThoughtNode[] = [root];
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		let currentId = root.id;
		while (nextMap.has(currentId)) { const n = thoughtById.get(nextMap.get(currentId)!); if (!n) break; timeline.push(n); currentId = n.id; }
		return timeline;
	}

	/** Get branch children of a thought. */
	getBranches(trainId: string, thoughtId: string): ThoughtNode[] {
		const train = this.findTrain(trainId);
		if (!train) return [];
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		return train.relations.filter((r) => r.fromId === thoughtId && r.direction === "branch").map((r) => thoughtById.get(r.toId)).filter(Boolean) as ThoughtNode[];
	}

	/** Get all children of a thought (any direction). */
	getChildren(trainId: string, thoughtId: string): ThoughtNode[] {
		const train = this.findTrain(trainId);
		if (!train) return [];
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		return train.relations.filter((r) => r.fromId === thoughtId).map((r) => thoughtById.get(r.toId)).filter(Boolean) as ThoughtNode[];
	}

	/** Get the set of thought IDs on the main chain. */
	getMainChainIds(trainId: string): Set<string> {
		const train = this.findTrain(trainId);
		return train ? computeMainChainIds(train) : new Set();
	}

	/** Get the head node (last main-chain thought) of a train. */
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
		if (!train || !train.thoughts.some((t) => t.id === sourceId)) return null;
		const parentMap = new Map<string, { parentId: string; direction: string }>();
		const nextMap = new Map<string, string>();
		for (const r of train.relations) {
			if (r.direction === "next" || r.direction === "branch") parentMap.set(r.toId, { parentId: r.fromId, direction: r.direction });
			if (r.direction === "next") nextMap.set(r.fromId, r.toId);
		}
		if (isBranchAlreadyMerged(train, sourceId, nextMap)) return null;
		let current = sourceId;
		const visited = new Set<string>();
		while (current) {
			if (visited.has(current)) return null;
			visited.add(current);
			const parent = parentMap.get(current);
			if (!parent) return null;
			if (parent.direction === "branch") return { targetId: nextMap.get(parent.parentId) ?? null, originId: parent.parentId };
			current = parent.parentId;
		}
		return null;
	}

	/** Merge a branch thought into a target thought. Only branch descendants can be merge sources. */
	async mergeBranch(trainId: string, sourceId: string, targetId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train || train.status === "completed") return false;
		const source = train.thoughts.find((t) => t.id === sourceId);
		const target = train.thoughts.find((t) => t.id === targetId);
		if (!source || !target || sourceId === targetId) return false;
		if (computeMainChainIds(train).has(sourceId)) return false;
		if (train.relations.find((r) => r.fromId === sourceId && r.toId === targetId && r.direction === "merge")) return false;
		if (isReachable(train, sourceId, targetId)) return false;
		train.relations.push({ fromId: sourceId, toId: targetId, direction: "merge" });
		await this.persist();
		void this.updateMergeFrontmatter(source, target, train);
		void this.eventBus.emit("train.branch.merged", { trainId, sourceId, targetId });
		return true;
	}

	/** Undo a merge — remove the merge relation between source and target. */
	async undoMerge(trainId: string, sourceId: string, targetId: string): Promise<boolean> {
		const train = this.findTrain(trainId);
		if (!train) return false;
		const idx = train.relations.findIndex((r) => r.fromId === sourceId && r.toId === targetId && r.direction === "merge");
		if (idx === -1) return false;
		train.relations.splice(idx, 1);
		await this.persist();
		const source = train.thoughts.find((t) => t.id === sourceId);
		if (source) void this.fileSystem.updateFrontmatter(source.path, { ...buildNavLinks(train, sourceId) });
		void this.eventBus.emit("train.branch.merge.undone", { trainId, sourceId, targetId });
		return true;
	}

	getMerges(trainId: string): ThoughtRelation[] {
		const train = this.findTrain(trainId);
		return train ? train.relations.filter((r) => r.direction === "merge") : [];
	}

	// ── Private helpers ──────────────────────────────────────────

	private findTrain(trainId: string): TrainState | undefined {
		return this.state.trains.find((t) => t.id === trainId);
	}

	private computeFolderPath(title: string, createdAt: string): string {
		const ts = createdAt.replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
		const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-");
		const { trainFolder } = this.getSettings();
		return trainFolder ? `${trainFolder}/${ts} ${safeTitle}` : `${ts} ${safeTitle}`;
	}

	private async updateMergeFrontmatter(source: ThoughtNode, target: ThoughtNode, train: TrainState): Promise<void> {
		await this.fileSystem.updateFrontmatter(source.path, { ...buildNavLinks(train, source.id) });
		await this.fileSystem.updateFrontmatter(target.path, { ...buildNavLinks(train, target.id) });
	}

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

	private createSessionViaEvent(title: string, durationMinutes: number): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const timeout = setTimeout(() => { unsub(); reject(new Error("Timeout waiting for session.created")); }, 5000);
			const unsub = this.eventBus.on("session.created", (event) => {
				clearTimeout(timeout); unsub();
				resolve((event.payload as { session: Session }).session.id);
			});
			void this.eventBus.emit("session.create", { type: "train-of-thought" as const, title: `Train: ${title}`, durationMinutes });
		});
	}

	private async updateThoughtFrontmatter(thought: ThoughtNode, train: TrainState, fromThought: ThoughtNode | null, _direction: ThoughtDirection): Promise<void> {
		await this.fileSystem.updateFrontmatter(thought.path, {
			"train-session": train.title, "thought-order": thought.order, ...buildNavLinks(train, thought.id),
		});
		if (fromThought) {
			await this.fileSystem.updateFrontmatter(fromThought.path, { ...buildNavLinks(train, fromThought.id) });
		}
	}
}
