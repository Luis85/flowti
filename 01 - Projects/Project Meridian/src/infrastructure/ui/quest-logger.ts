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
	/** Absolute tick at which this quest would expire if nobody completes it. */
	expiryTick: number | null;
	state: QuestState;
	/** Latest claimer — rewritten on every (re-)claim. */
	claimedBy: string | null;
	claimedTick: number | null;
	/** First agent who ever claimed this quest; never rewritten. */
	firstClaimedBy: string | null;
	firstClaimedTick: number | null;
	firstClaimedAt: number | null;
	/** Number of re-claims (= total claims - 1). Zero for a straight-through quest. */
	reclaimCount: number;
	/** Distinct agent ids who claimed the quest at any point in its lifecycle. */
	claimers: string[];
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
		/** Duration from creation in ticks before the quest expires. */
		expiryTicks: number;
		/** Absolute tick the quest was created at. */
		createdTick: number;
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
		// Pull itemId/quantity/expiryTicks from the quest board since QuestGenerated
		// payload doesn't carry them
		const board = deps.getQuestBoard();
		const boardEntry = board?.quests.find(q => q.id === questId);
		// Compute expiryTick only when both board fields are valid numbers; otherwise null.
		// Defensive — a malformed or not-yet-populated board entry shouldn't leak NaN into frontmatter.
		const expiryTick = boardEntry !== undefined
			&& typeof boardEntry.createdTick === 'number'
			&& typeof boardEntry.expiryTicks === 'number'
			? boardEntry.createdTick + boardEntry.expiryTicks
			: null;
		const entry: QuestLogEntry = {
			questId,
			type: stringField(p, 'type') ?? boardEntry?.type ?? 'unknown',
			facilityId: stringField(p, 'facilityId') ?? boardEntry?.facilityId ?? '',
			itemId: boardEntry?.itemId ?? null,
			quantity: boardEntry?.quantity ?? 1,
			reward: numberField(p, 'reward') ?? boardEntry?.reward ?? 0,
			createdTick: event.tick,
			expiryTick,
			state: 'open',
			claimedBy: null,
			claimedTick: null,
			firstClaimedBy: null,
			firstClaimedTick: null,
			firstClaimedAt: null,
			reclaimCount: 0,
			claimers: [],
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

		// First-claim vs re-claim bookkeeping — flow metrics distinguish them.
		// `firstClaimedTick` is set exactly once per quest lifecycle, even across
		// abandon → re-claim cycles. `claimedTick` always reflects the latest claim.
		const isFirstClaim = entry.firstClaimedTick === null;
		if (isFirstClaim) {
			entry.firstClaimedBy = agentId;
			entry.firstClaimedTick = event.tick;
			entry.firstClaimedAt = event.wallClock;
		} else {
			// Any claim after the first is a "re-claim" for process tracking
			entry.reclaimCount++;
		}

		// Track distinct claimers (a re-claim by the same agent doesn't add to the set)
		if (agentId !== null && !entry.claimers.includes(agentId)) {
			entry.claimers.push(agentId);
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
 * Serialize a quest log entry to a markdown file with YAML frontmatter.
 *
 * The frontmatter is designed to be consumable by Obsidian Bases — every field
 * is explicitly typed, nullable fields emit `null` instead of being omitted so
 * Bases can build consistent columns, and tags follow the `quest/<facet>` convention.
 * The body below the frontmatter is a human-readable snapshot of the same data.
 */
export function serializeQuest(entry: QuestLogEntry, resolveName: (id: string) => string): string {
	const facilityName = resolveName(entry.facilityId);
	const claimedByName = entry.claimedBy !== null ? resolveName(entry.claimedBy) : null;
	const firstClaimedByName = entry.firstClaimedBy !== null ? resolveName(entry.firstClaimedBy) : null;

	const frontmatter = buildFrontmatter(entry, facilityName, claimedByName, firstClaimedByName);
	const body = buildBody(entry, facilityName, claimedByName);

	return `---\n${frontmatter}\n---\n${body}`;
}

function buildFrontmatter(
	entry: QuestLogEntry,
	facilityName: string,
	claimedByName: string | null,
	firstClaimedByName: string | null,
): string {
	const metrics = computeFlowMetrics(entry);

	const lines: string[] = [];

	// ── Identity ───────────────────────────────────────────────
	lines.push(`id: ${yamlString(entry.questId)}`);
	lines.push(`quest_type: ${yamlString(entry.type)}`);
	lines.push(`state: ${yamlString(entry.state)}`);
	lines.push(`resolution: ${entry.resolution !== null ? yamlString(entry.resolution) : 'null'}`);
	lines.push(`stage: ${yamlString(metrics.stage)}`);
	lines.push(`outcome: ${yamlString(metrics.outcome)}`);

	// ── Target ─────────────────────────────────────────────────
	lines.push(`facility: ${yamlString(facilityName)}`);
	lines.push(`facility_id: ${yamlString(entry.facilityId)}`);
	lines.push(`item: ${entry.itemId !== null ? yamlString(entry.itemId) : 'null'}`);
	lines.push(`quantity: ${entry.itemId !== null ? String(entry.quantity) : 'null'}`);

	// ── Economy ────────────────────────────────────────────────
	lines.push(`reward: ${String(entry.reward)}`);
	lines.push(`reward_per_tick: ${metrics.rewardPerTick !== null ? metrics.rewardPerTick.toFixed(4) : 'null'}`);

	// ── Timeline ticks ─────────────────────────────────────────
	lines.push(`created_tick: ${String(entry.createdTick)}`);
	lines.push(`expiry_tick: ${entry.expiryTick !== null ? String(entry.expiryTick) : 'null'}`);
	lines.push(`first_claimed_tick: ${entry.firstClaimedTick !== null ? String(entry.firstClaimedTick) : 'null'}`);
	lines.push(`claimed_tick: ${entry.claimedTick !== null ? String(entry.claimedTick) : 'null'}`);
	lines.push(`resolved_tick: ${entry.resolvedTick !== null ? String(entry.resolvedTick) : 'null'}`);

	// ── Flow metrics (Kanban / Lean flow analysis) ─────────────
	// lead = total time in the system; queue = time waiting to be picked up;
	// cycle = time from first claim to resolution; wait_ratio = queue/lead.
	lines.push(`lead_time_ticks: ${metrics.leadTimeTicks !== null ? String(metrics.leadTimeTicks) : 'null'}`);
	lines.push(`queue_time_ticks: ${metrics.queueTimeTicks !== null ? String(metrics.queueTimeTicks) : 'null'}`);
	lines.push(`cycle_time_ticks: ${metrics.cycleTimeTicks !== null ? String(metrics.cycleTimeTicks) : 'null'}`);
	lines.push(`wait_ratio: ${metrics.waitRatio !== null ? metrics.waitRatio.toFixed(4) : 'null'}`);
	// Kept for backward compatibility with the initial schema — same as lead_time_ticks
	lines.push(`duration_ticks: ${metrics.leadTimeTicks !== null ? String(metrics.leadTimeTicks) : 'null'}`);

	// ── Process control ────────────────────────────────────────
	lines.push(`reclaim_count: ${String(entry.reclaimCount)}`);
	lines.push(`touched_by_count: ${String(entry.claimers.length)}`);
	lines.push(`met_sla: ${metrics.metSla !== null ? String(metrics.metSla) : 'null'}`);
	lines.push(`size: ${metrics.size !== null ? yamlString(metrics.size) : 'null'}`);

	// ── Participants ───────────────────────────────────────────
	lines.push(`first_claimed_by: ${firstClaimedByName !== null ? yamlString(firstClaimedByName) : 'null'}`);
	lines.push(`first_claimed_by_id: ${entry.firstClaimedBy !== null ? yamlString(entry.firstClaimedBy) : 'null'}`);
	lines.push(`claimed_by: ${claimedByName !== null ? yamlString(claimedByName) : 'null'}`);
	lines.push(`claimed_by_id: ${entry.claimedBy !== null ? yamlString(entry.claimedBy) : 'null'}`);

	// ── Wall-clock timestamps ──────────────────────────────────
	const createdAt = entry.timeline[0]?.wallClock;
	const resolvedAt = entry.resolution !== null ? entry.timeline.at(-1)?.wallClock : undefined;
	lines.push(`created_at: ${createdAt !== undefined ? isoDateTime(createdAt) : 'null'}`);
	lines.push(`first_claimed_at: ${entry.firstClaimedAt !== null ? isoDateTime(entry.firstClaimedAt) : 'null'}`);
	lines.push(`resolved_at: ${resolvedAt !== undefined ? isoDateTime(resolvedAt) : 'null'}`);

	// ── Stats ──────────────────────────────────────────────────
	lines.push(`timeline_events: ${String(entry.timeline.length)}`);

	// ── Tags (Obsidian tag facets) ─────────────────────────────
	const tags = buildTags(entry, metrics);
	lines.push('tags:');
	for (const tag of tags) {
		lines.push(`  - ${tag}`);
	}

	return lines.join('\n');
}

/**
 * Compute all derived flow metrics in one place so frontmatter emission is a
 * pure string assembly. Separated for testability — the test suite imports
 * this directly to assert metric correctness without parsing YAML back.
 */
export interface QuestFlowMetrics {
	stage: 'waiting' | 'active' | 'done';
	outcome: 'pending' | 'success' | 'expired' | 'abandoned';
	leadTimeTicks: number | null;
	queueTimeTicks: number | null;
	cycleTimeTicks: number | null;
	waitRatio: number | null;
	rewardPerTick: number | null;
	metSla: boolean | null;
	size: 'small' | 'medium' | 'large' | 'xl' | null;
}

export function computeFlowMetrics(entry: QuestLogEntry): QuestFlowMetrics {
	// Stage is a high-level kanban-style bucket derived from state + resolution.
	const stage: QuestFlowMetrics['stage'] = entry.resolution !== null
		? 'done'
		: entry.state === 'claimed'
			? 'active'
			: 'waiting';

	// Outcome normalizes the resolution for process analysis. 'pending' means
	// the quest is still in-flight (so not written to disk yet in practice).
	const outcome: QuestFlowMetrics['outcome'] = entry.resolution === 'completed'
		? 'success'
		: entry.resolution === 'expired'
			? 'expired'
			: entry.resolution === 'abandoned'
				? 'abandoned'
				: 'pending';

	const leadTimeTicks = entry.resolvedTick !== null
		? entry.resolvedTick - entry.createdTick
		: null;

	const queueTimeTicks = entry.firstClaimedTick !== null
		? entry.firstClaimedTick - entry.createdTick
		: null;

	const cycleTimeTicks = entry.firstClaimedTick !== null && entry.resolvedTick !== null
		? entry.resolvedTick - entry.firstClaimedTick
		: null;

	const waitRatio = leadTimeTicks !== null && leadTimeTicks > 0 && queueTimeTicks !== null
		? queueTimeTicks / leadTimeTicks
		: null;

	// Reward efficiency: only meaningful for successful quests with positive cycle time.
	const rewardPerTick = outcome === 'success' && cycleTimeTicks !== null && cycleTimeTicks > 0
		? entry.reward / cycleTimeTicks
		: null;

	// SLA: did the quest resolve before its expiry tick?
	//   - success past expiry still counts as a miss (late delivery is a miss)
	//   - expired / abandoned past expiry are misses
	//   - active quests have null SLA until terminal
	let metSla: boolean | null = null;
	if (entry.expiryTick !== null && entry.resolvedTick !== null) {
		metSla = entry.resolvedTick <= entry.expiryTick && outcome === 'success';
	}

	// Size class from cycle time. Using cycle time (not lead time) means a
	// quest that sat on the board for hours doesn't get penalized for being "big".
	let size: QuestFlowMetrics['size'] = null;
	if (cycleTimeTicks !== null) {
		if (cycleTimeTicks <= 60) size = 'small';
		else if (cycleTimeTicks <= 240) size = 'medium';
		else if (cycleTimeTicks <= 600) size = 'large';
		else size = 'xl';
	}

	return { stage, outcome, leadTimeTicks, queueTimeTicks, cycleTimeTicks, waitRatio, rewardPerTick, metSla, size };
}


function buildTags(entry: QuestLogEntry, metrics: QuestFlowMetrics): string[] {
	const tags = ['quest', `quest/${entry.type}`];
	if (entry.resolution !== null) {
		tags.push(`quest/${entry.resolution}`);
	} else {
		tags.push(`quest/${entry.state}`);
	}
	tags.push(`quest/stage/${metrics.stage}`);
	tags.push(`quest/outcome/${metrics.outcome}`);
	if (metrics.size !== null) tags.push(`quest/size/${metrics.size}`);
	if (metrics.metSla === true) tags.push('quest/sla/met');
	if (metrics.metSla === false) tags.push('quest/sla/missed');
	if (entry.reclaimCount > 0) tags.push('quest/reclaimed');
	return tags;
}

function buildBody(
	entry: QuestLogEntry,
	facilityName: string,
	claimedByName: string | null,
): string {
	const resolutionLabel = entry.resolution ?? 'in progress';
	const duration = entry.resolvedTick !== null
		? `${String(entry.resolvedTick - entry.createdTick)}t`
		: 'ongoing';
	const item = entry.itemId !== null ? `${entry.itemId}x${String(entry.quantity)}` : '—';
	const claimedByDisplay = claimedByName ?? '—';

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
	lines.push(`- **Claimed by**: ${claimedByDisplay}`);
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

/**
 * Quote a YAML string only if it contains characters that would trip the parser.
 * Safe plain scalars are left bare for readability (matching existing Meridian conventions).
 */
function yamlString(s: string): string {
	if (s === '') return '""';
	// Always quote if the string starts with a YAML indicator character
	if (/^[-?:,[\]{}#&*!|>%@`"']/.test(s)) return JSON.stringify(s);
	// Always quote if it contains structure-breaking chars or ": " sequences
	if (/[:#[\]{},&*!|>"'`]/.test(s)) return JSON.stringify(s);
	if (s.includes(': ')) return JSON.stringify(s);
	// Leave simple strings bare (alphanumeric, spaces, underscores, dashes, dots)
	return s;
}

/**
 * Format a wall-clock millisecond timestamp as an ISO 8601 datetime that
 * Obsidian's property editor recognizes as a Date.
 */
function isoDateTime(ms: number): string {
	const iso = new Date(ms).toISOString();
	// Strip fractional seconds and the trailing Z for cleaner display;
	// Obsidian still parses this as a datetime value.
	return iso.slice(0, 19);
}

function stringField(payload: Record<string, unknown>, key: string): string | null {
	const value = payload[key];
	return typeof value === 'string' ? value : null;
}

function numberField(payload: Record<string, unknown>, key: string): number | null {
	const value = payload[key];
	return typeof value === 'number' ? value : null;
}
