import type { EventBus, GameEvent, Unsubscribe } from '../../domain/core/events.js';

/**
 * Per-quest event logger. Subscribes to the event bus, captures every event
 * that references a known questId, and persists a markdown file for each quest
 * on terminal resolution (completed / expired / abandoned).
 *
 * Also kept in memory (capped) so the debug overlay can render a Quests tab.
 */

export type QuestState = 'open' | 'claimed' | 'completed' | 'expired' | 'abandoned';

export interface QuestTimelineEntry {
	tick: number;
	wallClock: number;
	type: string;
	message: string;
}

export interface QuestLogEntry {
	questId: string;
	type: string;
	facilityId: string;
	itemId: string | null;
	quantity: number;
	reward: number;
	createdTick: number;
	state: QuestState;
	claimedBy: string | null;
	claimedTick: number | null;
	resolvedTick: number | null;
	resolution: 'completed' | 'expired' | 'abandoned' | null;
	timeline: QuestTimelineEntry[];
}

/** Narrow view over the quest board — matches what QuestBoardComponent.state exposes. */
export interface QuestBoardSnapshot {
	quests: {
		id: string;
		type: string;
		facilityId: string;
		itemId: string | null;
		quantity: number;
		reward: number;
	}[];
}

export interface QuestLoggerDeps {
	eventBus: EventBus;
	/** Look up a quest on the board at the moment QuestGenerated fires (for itemId/quantity). */
	getQuestBoard: () => QuestBoardSnapshot | null;
	/** Resolve facility and agent ids to human names. */
	resolveName: (id: string) => string;
	/** Optional — if provided, resolved quests are persisted to `<dataRoot>/Economy/Quests/quest-<id>.md`. */
	writeFile?: (path: string, content: string) => Promise<void>;
	/** Base path for persisted logs. Usually `gameDeps.dataRoot`. */
	dataRoot: () => string;
	/** Max number of entries kept in memory before oldest resolved ones are evicted. */
	maxInMemory?: number;
}

export interface QuestLogger {
	getQuests(): QuestLogEntry[];
	getQuest(id: string): QuestLogEntry | undefined;
	toMarkdown(entry: QuestLogEntry): string;
	/** The same resolveName injected via deps — exposed so UIs can render consistent names. */
	resolveName(id: string): string;
	dispose(): void;
}

const DEFAULT_MAX = 200;

export function createQuestLogger(deps: QuestLoggerDeps): QuestLogger {
	const quests = new Map<string, QuestLogEntry>();
	const maxInMemory = deps.maxInMemory ?? DEFAULT_MAX;
	const unsubs: Unsubscribe[] = [];

	function appendTimeline(entry: QuestLogEntry, event: GameEvent, message: string): void {
		entry.timeline.push({
			tick: event.tick,
			wallClock: event.wallClock,
			type: event.type,
			message,
		});
	}

	function evictIfFull(): void {
		if (quests.size <= maxInMemory) return;
		// Evict the oldest terminal quest; keep active quests regardless of age.
		for (const [id, entry] of quests) {
			if (entry.resolution !== null) {
				quests.delete(id);
				if (quests.size <= maxInMemory) return;
			}
		}
	}

	function persistIfResolved(entry: QuestLogEntry): void {
		if (deps.writeFile === undefined) return;
		if (entry.resolution === null) return;
		const root = deps.dataRoot();
		if (root === '') return;
		const safeId = entry.questId.replace(/[^a-zA-Z0-9_-]/g, '_');
		const path = `${root}/Economy/Quests/quest-${safeId}.md`;
		const content = toMarkdown(entry);
		void deps.writeFile(path, content).catch(() => {
			// Silent — quest logging is observational and must never disrupt gameplay.
		});
	}

	function handleGenerated(event: GameEvent): void {
		const p = event.payload;
		const questId = stringField(p, 'questId');
		if (questId === null) return;
		// Pull itemId/quantity from the quest board since QuestGenerated payload doesn't carry them
		const board = deps.getQuestBoard();
		const boardEntry = board?.quests.find(q => q.id === questId);
		const entry: QuestLogEntry = {
			questId,
			type: stringField(p, 'type') ?? boardEntry?.type ?? 'unknown',
			facilityId: stringField(p, 'facilityId') ?? boardEntry?.facilityId ?? '',
			itemId: boardEntry?.itemId ?? null,
			quantity: boardEntry?.quantity ?? 1,
			reward: numberField(p, 'reward') ?? boardEntry?.reward ?? 0,
			createdTick: event.tick,
			state: 'open',
			claimedBy: null,
			claimedTick: null,
			resolvedTick: null,
			resolution: null,
			timeline: [],
		};
		const facilityName = deps.resolveName(entry.facilityId);
		const itemLabel = entry.itemId !== null ? ` for ${entry.itemId}x${String(entry.quantity)}` : '';
		appendTimeline(entry, event, `Generated ${entry.type} quest at ${facilityName}${itemLabel} · ${String(entry.reward)}g reward`);
		quests.set(questId, entry);
		evictIfFull();
	}

	function handleClaimed(event: GameEvent): void {
		const questId = stringField(event.payload, 'questId');
		if (questId === null) return;
		const entry = quests.get(questId);
		if (entry === undefined) return;
		const agentId = stringField(event.payload, 'agentId');

		// If the quest is being re-claimed after a previous terminal state
		// (e.g. abandoned → reopened → reclaimed), reset the resolution fields
		// but keep the timeline history so the full lifecycle is preserved.
		const isReclaim = entry.resolution !== null;
		if (isReclaim) {
			entry.resolution = null;
			entry.resolvedTick = null;
		}
		entry.state = 'claimed';
		entry.claimedBy = agentId;
		entry.claimedTick = event.tick;
		const agentName = agentId !== null ? deps.resolveName(agentId) : 'unknown';
		appendTimeline(entry, event, isReclaim ? `Re-claimed by ${agentName}` : `Claimed by ${agentName}`);
	}

	function handleCompleted(event: GameEvent): void {
		const questId = stringField(event.payload, 'questId');
		if (questId === null) return;
		const entry = quests.get(questId);
		if (entry === undefined) return;
		entry.state = 'completed';
		entry.resolution = 'completed';
		entry.resolvedTick = event.tick;
		const agentId = stringField(event.payload, 'agentId');
		const reward = numberField(event.payload, 'reward') ?? entry.reward;
		const agentName = agentId !== null ? deps.resolveName(agentId) : 'unknown';
		appendTimeline(entry, event, `Completed by ${agentName} (+${String(reward)}g)`);
		persistIfResolved(entry);
	}

	function handleExpired(event: GameEvent): void {
		const questId = stringField(event.payload, 'questId');
		if (questId === null) return;
		const entry = quests.get(questId);
		if (entry === undefined) return;
		entry.state = 'expired';
		entry.resolution = 'expired';
		entry.resolvedTick = event.tick;
		appendTimeline(entry, event, 'Expired (time limit reached)');
		persistIfResolved(entry);
	}

	function handleAbandoned(event: GameEvent): void {
		const questId = stringField(event.payload, 'questId');
		if (questId === null) return;
		const entry = quests.get(questId);
		if (entry === undefined) return;
		// Abandonment sends the quest back to 'open' on the board, but for the log
		// we capture it as a terminal event tied to the agent who bailed.
		entry.state = 'abandoned';
		entry.resolution = 'abandoned';
		entry.resolvedTick = event.tick;
		const agentId = stringField(event.payload, 'agentId');
		const reason = stringField(event.payload, 'reason') ?? 'unknown';
		const agentName = agentId !== null ? deps.resolveName(agentId) : 'unknown';
		appendTimeline(entry, event, `Abandoned by ${agentName} (${reason})`);
		persistIfResolved(entry);
	}

	function handleRewardSkipped(event: GameEvent): void {
		const questId = stringField(event.payload, 'questId');
		if (questId === null) return;
		const entry = quests.get(questId);
		if (entry === undefined) return;
		const reason = stringField(event.payload, 'reason') ?? 'unknown';
		appendTimeline(entry, event, `Reward skipped (${reason})`);
	}

	unsubs.push(deps.eventBus.on('QuestGenerated', handleGenerated));
	unsubs.push(deps.eventBus.on('QuestClaimed', handleClaimed));
	unsubs.push(deps.eventBus.on('QuestCompleted', handleCompleted));
	unsubs.push(deps.eventBus.on('QuestExpired', handleExpired));
	unsubs.push(deps.eventBus.on('QuestAbandoned', handleAbandoned));
	unsubs.push(deps.eventBus.on('QuestRewardSkipped', handleRewardSkipped));

	function toMarkdown(entry: QuestLogEntry): string {
		return serializeQuest(entry, deps.resolveName);
	}

	return {
		getQuests(): QuestLogEntry[] {
			// Return newest-first (by createdTick, ties broken by resolution state)
			return [...quests.values()].sort((a, b) => b.createdTick - a.createdTick);
		},
		getQuest(id: string): QuestLogEntry | undefined {
			return quests.get(id);
		},
		toMarkdown,
		resolveName: deps.resolveName,
		dispose(): void {
			for (const unsub of unsubs) unsub();
			unsubs.length = 0;
			quests.clear();
		},
	};
}

/**
 * Serialize a quest log entry to markdown. Pure — exported for use by the
 * debug overlay (inline rendering) and the file writer.
 */
export function serializeQuest(entry: QuestLogEntry, resolveName: (id: string) => string): string {
	const facilityName = resolveName(entry.facilityId);
	const resolutionLabel = entry.resolution ?? 'in progress';
	const duration = entry.resolvedTick !== null
		? `${String(entry.resolvedTick - entry.createdTick)}t`
		: 'ongoing';
	const claimedBy = entry.claimedBy !== null ? resolveName(entry.claimedBy) : '—';
	const item = entry.itemId !== null ? `${entry.itemId}x${String(entry.quantity)}` : '—';

	const lines: string[] = [];
	lines.push(`# Quest ${entry.questId}`);
	lines.push('');
	lines.push(`- **Type**: ${entry.type}`);
	lines.push(`- **Target**: ${facilityName} (\`${entry.facilityId}\`)`);
	lines.push(`- **Item**: ${item}`);
	lines.push(`- **Reward**: ${String(entry.reward)}g`);
	lines.push(`- **Created**: t${String(entry.createdTick)}`);
	lines.push(`- **State**: ${entry.state}`);
	lines.push(`- **Resolution**: ${resolutionLabel}`);
	lines.push(`- **Resolved at**: ${entry.resolvedTick !== null ? `t${String(entry.resolvedTick)}` : '—'}`);
	lines.push(`- **Duration**: ${duration}`);
	lines.push(`- **Claimed by**: ${claimedBy}`);
	lines.push('');
	lines.push('## Timeline');
	lines.push('');
	if (entry.timeline.length === 0) {
		lines.push('_(no events recorded)_');
	} else {
		for (const ev of entry.timeline) {
			lines.push(`- **t${String(ev.tick)}** · ${ev.type} — ${ev.message}`);
		}
	}
	lines.push('');
	return lines.join('\n');
}

function stringField(payload: Record<string, unknown>, key: string): string | null {
	const value = payload[key];
	return typeof value === 'string' ? value : null;
}

function numberField(payload: Record<string, unknown>, key: string): number | null {
	const value = payload[key];
	return typeof value === 'number' ? value : null;
}
