import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createQuestLogger,
	serializeQuest,
	computeFlowMetrics,
	type QuestLogger,
	type QuestLogEntry,
} from '../../../src/infrastructure/ui/quest-logger.js';

/** Test helper — merges partial fixture into a complete QuestLogEntry with sane defaults. */
function mkEntry(partial: Partial<QuestLogEntry> & { questId: string; type: string; facilityId: string; createdTick: number }): QuestLogEntry {
	return {
		itemId: null,
		quantity: 1,
		reward: 10,
		expiryTick: null,
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
		...partial,
	};
}
import type { EventBus, EventHandler, GameEvent, Unsubscribe } from '../../../src/domain/core/events.js';

function makeBus(): { bus: EventBus; fire: (e: Partial<GameEvent>) => void } {
	const handlers = new Map<string, Set<EventHandler>>();

	const bus: EventBus = {
		emit: (event: GameEvent) => {
			for (const h of handlers.get(event.type) ?? []) h(event);
		},
		on: (type: string, handler: EventHandler): Unsubscribe => {
			if (!handlers.has(type)) handlers.set(type, new Set());
			handlers.get(type)!.add(handler);
			return () => { handlers.get(type)?.delete(handler); };
		},
		off: (type: string, handler: EventHandler) => { handlers.get(type)?.delete(handler); },
		onAny: () => () => { /* test bus doesn't implement */ },
		filter: () => () => { /* test bus doesn't implement */ },
		history: () => [],
	};

	const fire = (e: Partial<GameEvent>): void => {
		const event: GameEvent = {
			type: e.type ?? 'Unknown',
			tick: e.tick ?? 0,
			wallClock: e.wallClock ?? Date.now(),
			source: e.source ?? 'test',
			payload: e.payload ?? {},
		};
		for (const h of handlers.get(event.type) ?? []) h(event);
	};

	return { bus, fire };
}

function makeBoard(quests: {
	id: string;
	type?: string;
	facilityId?: string;
	itemId?: string | null;
	quantity?: number;
	reward?: number;
	expiryTicks?: number;
	createdTick?: number;
}[]): { quests: { id: string; type: string; facilityId: string; itemId: string | null; quantity: number; reward: number; expiryTicks: number; createdTick: number }[] } {
	return {
		quests: quests.map(q => ({
			id: q.id,
			type: q.type ?? 'supply',
			facilityId: q.facilityId ?? 'loc-x',
			itemId: q.itemId ?? null,
			quantity: q.quantity ?? 1,
			reward: q.reward ?? 10,
			expiryTicks: q.expiryTicks ?? 100,
			createdTick: q.createdTick ?? 0,
		})),
	};
}

const resolveName = (id: string): string => {
	const map: Record<string, string> = {
		'loc-workshop': 'Workshop',
		'loc-market': 'Market Stall',
		'agent-bram': 'Bram',
		'agent-alice': 'Alice',
	};
	return map[id] ?? id;
};

describe('createQuestLogger', () => {
	let logger: QuestLogger;
	let fire: (e: Partial<GameEvent>) => void;
	let writeFile: ReturnType<typeof vi.fn>;
	let board: ReturnType<typeof makeBoard>;

	beforeEach(() => {
		const b = makeBus();
		fire = b.fire;
		board = makeBoard([
			{ id: 'q1', type: 'supply', facilityId: 'loc-market', itemId: 'food', quantity: 3, reward: 15 },
			{ id: 'q2', type: 'repair', facilityId: 'loc-workshop', reward: 20 },
		]);
		writeFile = vi.fn().mockResolvedValue(undefined);
		logger = createQuestLogger({
			eventBus: b.bus,
			getQuestBoard: () => board,
			resolveName,
			writeFile,
			dataRoot: () => '03 - Resources',
		});
	});

	it('captures a quest on QuestGenerated and enriches it from the board', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		const entry = logger.getQuest('q1');
		expect(entry).toBeDefined();
		expect(entry?.type).toBe('supply');
		expect(entry?.itemId).toBe('food');
		expect(entry?.quantity).toBe(3);
		expect(entry?.reward).toBe(15);
		expect(entry?.state).toBe('open');
		expect(entry?.timeline).toHaveLength(1);
		expect(entry?.timeline[0]?.message).toContain('Market Stall');
		expect(entry?.timeline[0]?.message).toContain('food');
		expect(entry?.timeline[0]?.message).toContain('15g');
	});

	it('transitions through claim → complete and appends timeline entries', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestClaimed', tick: 10, payload: { questId: 'q1', agentId: 'agent-bram', questType: 'supply', facilityId: 'loc-market' } });
		fire({ type: 'QuestCompleted', tick: 25, payload: { questId: 'q1', agentId: 'agent-bram', questType: 'supply', facilityId: 'loc-market', reward: 15 } });

		const entry = logger.getQuest('q1')!;
		expect(entry.state).toBe('completed');
		expect(entry.resolution).toBe('completed');
		expect(entry.claimedBy).toBe('agent-bram');
		expect(entry.claimedTick).toBe(10);
		expect(entry.resolvedTick).toBe(25);
		expect(entry.timeline).toHaveLength(3);
		expect(entry.timeline[1]?.message).toContain('Bram');
		expect(entry.timeline[2]?.message).toContain('Bram');
		expect(entry.timeline[2]?.message).toContain('+15g');
	});

	it('persists a markdown file when a quest reaches terminal state', async () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestCompleted', tick: 25, payload: { questId: 'q1', agentId: 'agent-bram', reward: 15 } });

		// writeFile is called asynchronously — wait a microtask
		await Promise.resolve();
		expect(writeFile).toHaveBeenCalledTimes(1);
		const [path, content] = writeFile.mock.calls[0] as [string, string];
		expect(path).toBe('03 - Resources/Economy/Quests/quest-q1.md');
		expect(content).toContain('# Quest q1');
		expect(content).toContain('## Timeline');
		expect(content).toContain('Bram');
	});

	it('does not write when dataRoot is empty', () => {
		const b = makeBus();
		const localWrite = vi.fn();
		const localLogger = createQuestLogger({
			eventBus: b.bus,
			getQuestBoard: () => board,
			resolveName,
			writeFile: localWrite,
			dataRoot: () => '',
		});
		b.fire({ type: 'QuestGenerated', tick: 1, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		b.fire({ type: 'QuestExpired', tick: 10, payload: { questId: 'q1', facilityId: 'loc-market' } });
		expect(localWrite).not.toHaveBeenCalled();
		localLogger.dispose();
	});

	it('handles QuestExpired with facility-only payload', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestExpired', tick: 50, payload: { questId: 'q1', facilityId: 'loc-market' } });
		const entry = logger.getQuest('q1')!;
		expect(entry.state).toBe('expired');
		expect(entry.resolution).toBe('expired');
		expect(entry.timeline.at(-1)?.message).toBe('Expired (time limit reached)');
	});

	it('handles QuestAbandoned and captures reason', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestClaimed', tick: 10, payload: { questId: 'q1', agentId: 'agent-bram' } });
		fire({ type: 'QuestAbandoned', tick: 20, payload: { questId: 'q1', agentId: 'agent-bram', reason: 'abandoned' } });
		const entry = logger.getQuest('q1')!;
		expect(entry.resolution).toBe('abandoned');
		expect(entry.timeline.at(-1)?.message).toContain('Bram');
		expect(entry.timeline.at(-1)?.message).toContain('abandoned');
	});

	it('appends QuestRewardSkipped to the timeline without changing state', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestClaimed', tick: 10, payload: { questId: 'q1', agentId: 'agent-bram' } });
		fire({ type: 'QuestRewardSkipped', tick: 15, payload: { questId: 'q1', agentId: 'agent-bram', reason: 'treasury_empty' } });
		const entry = logger.getQuest('q1')!;
		expect(entry.state).toBe('claimed');
		expect(entry.timeline.at(-1)?.message).toContain('treasury_empty');
	});

	it('ignores events for unknown quest ids', () => {
		// No QuestGenerated fired first — Claimed on a missing id should be a no-op, not throw
		expect(() => {
			fire({ type: 'QuestClaimed', tick: 10, payload: { questId: 'missing', agentId: 'agent-bram' } });
		}).not.toThrow();
		expect(logger.getQuest('missing')).toBeUndefined();
	});

	it('ignores events with no questId', () => {
		expect(() => {
			fire({ type: 'QuestGenerated', tick: 5, payload: { type: 'supply' } });
		}).not.toThrow();
		expect(logger.getQuests()).toHaveLength(0);
	});

	it('getQuests returns newest-first', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestGenerated', tick: 10, payload: { questId: 'q2', type: 'repair', facilityId: 'loc-workshop', reward: 20 } });
		const list = logger.getQuests();
		expect(list).toHaveLength(2);
		expect(list[0]?.questId).toBe('q2');
		expect(list[1]?.questId).toBe('q1');
	});

	it('tracks first-claim separately from latest claim', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestClaimed', tick: 10, wallClock: 1000, payload: { questId: 'q1', agentId: 'agent-bram' } });

		const entry = logger.getQuest('q1')!;
		expect(entry.firstClaimedBy).toBe('agent-bram');
		expect(entry.firstClaimedTick).toBe(10);
		expect(entry.firstClaimedAt).toBe(1000);
		expect(entry.reclaimCount).toBe(0);
		expect(entry.claimers).toEqual(['agent-bram']);
	});

	it('preserves first-claim info and increments reclaim count on reclaim', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestClaimed', tick: 10, wallClock: 1000, payload: { questId: 'q1', agentId: 'agent-bram' } });
		fire({ type: 'QuestAbandoned', tick: 20, payload: { questId: 'q1', agentId: 'agent-bram', reason: 'abandoned' } });
		fire({ type: 'QuestClaimed', tick: 25, wallClock: 2000, payload: { questId: 'q1', agentId: 'agent-alice' } });

		const entry = logger.getQuest('q1')!;
		expect(entry.firstClaimedBy).toBe('agent-bram');
		expect(entry.firstClaimedTick).toBe(10);
		expect(entry.firstClaimedAt).toBe(1000);
		expect(entry.claimedBy).toBe('agent-alice');
		expect(entry.claimedTick).toBe(25);
		expect(entry.reclaimCount).toBe(1);
		expect(entry.claimers).toEqual(['agent-bram', 'agent-alice']);
	});

	it('reclaim by the same agent still increments reclaim count but keeps claimers unique', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestClaimed', tick: 10, payload: { questId: 'q1', agentId: 'agent-bram' } });
		fire({ type: 'QuestAbandoned', tick: 20, payload: { questId: 'q1', agentId: 'agent-bram', reason: 'abandoned' } });
		fire({ type: 'QuestClaimed', tick: 25, payload: { questId: 'q1', agentId: 'agent-bram' } });

		const entry = logger.getQuest('q1')!;
		expect(entry.reclaimCount).toBe(1);
		expect(entry.claimers).toEqual(['agent-bram']);
	});

	it('captures expiryTick from the quest board at generation time', () => {
		board.quests[0]!.expiryTicks = 300;
		board.quests[0]!.createdTick = 5;
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		const entry = logger.getQuest('q1')!;
		expect(entry.expiryTick).toBe(305);
	});

	it('resets resolution on re-claim after abandonment', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestClaimed', tick: 10, payload: { questId: 'q1', agentId: 'agent-bram' } });
		fire({ type: 'QuestAbandoned', tick: 20, payload: { questId: 'q1', agentId: 'agent-bram', reason: 'abandoned' } });

		// After abandonment, the board resets the quest to open; another agent claims it
		fire({ type: 'QuestClaimed', tick: 25, payload: { questId: 'q1', agentId: 'agent-alice' } });

		const entry = logger.getQuest('q1')!;
		expect(entry.state).toBe('claimed');
		expect(entry.resolution).toBeNull();
		expect(entry.resolvedTick).toBeNull();
		expect(entry.claimedBy).toBe('agent-alice');
		expect(entry.claimedTick).toBe(25);
		// Timeline preserves history
		const messages = entry.timeline.map(t => t.message);
		expect(messages[0]).toContain('Generated');
		expect(messages[1]).toBe('Claimed by Bram');
		expect(messages[2]).toContain('Abandoned by Bram');
		expect(messages[3]).toBe('Re-claimed by Alice');
	});

	it('re-claim followed by completion produces a consistent terminal state', async () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		fire({ type: 'QuestClaimed', tick: 10, payload: { questId: 'q1', agentId: 'agent-bram' } });
		fire({ type: 'QuestAbandoned', tick: 20, payload: { questId: 'q1', agentId: 'agent-bram', reason: 'abandoned' } });
		fire({ type: 'QuestClaimed', tick: 25, payload: { questId: 'q1', agentId: 'agent-alice' } });
		fire({ type: 'QuestCompleted', tick: 40, payload: { questId: 'q1', agentId: 'agent-alice', reward: 15 } });

		const entry = logger.getQuest('q1')!;
		expect(entry.state).toBe('completed');
		expect(entry.resolution).toBe('completed');
		expect(entry.resolvedTick).toBe(40);
		expect(entry.claimedBy).toBe('agent-alice');

		await Promise.resolve();
		// Two writes total: one at abandonment, one at completion. Final file has the completion state.
		expect(writeFile).toHaveBeenCalledTimes(2);
	});

	it('dispose unsubscribes from the bus', () => {
		fire({ type: 'QuestGenerated', tick: 5, payload: { questId: 'q1', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		expect(logger.getQuests()).toHaveLength(1);
		logger.dispose();
		expect(logger.getQuests()).toHaveLength(0);
		// Firing after dispose should do nothing
		fire({ type: 'QuestGenerated', tick: 10, payload: { questId: 'q3', type: 'supply', facilityId: 'loc-market', reward: 15 } });
		expect(logger.getQuests()).toHaveLength(0);
	});

	it('sanitizes unsafe characters in quest IDs when building file paths', async () => {
		const b = makeBus();
		const localWrite = vi.fn().mockResolvedValue(undefined);
		const localLogger = createQuestLogger({
			eventBus: b.bus,
			getQuestBoard: () => makeBoard([{ id: 'quest/../etc', facilityId: 'loc-x' }]),
			resolveName,
			writeFile: localWrite,
			dataRoot: () => 'root',
		});
		b.fire({ type: 'QuestGenerated', tick: 1, payload: { questId: 'quest/../etc', type: 'supply', facilityId: 'loc-x', reward: 10 } });
		b.fire({ type: 'QuestCompleted', tick: 5, payload: { questId: 'quest/../etc', reward: 10 } });
		await Promise.resolve();
		expect(localWrite).toHaveBeenCalled();
		const [path] = localWrite.mock.calls[0] as [string, string];
		// 'quest/../etc' has 4 unsafe chars (two slashes, two dots) → 4 underscores
		expect(path).toBe('root/Economy/Quests/quest-quest____etc.md');
		localLogger.dispose();
	});
});

describe('serializeQuest', () => {
	function completedSupplyQuest(): QuestLogEntry {
		// 2026-04-11 12:39:00 UTC → ms epoch
		const createdMs = Date.UTC(2026, 3, 11, 12, 39, 0);
		const resolvedMs = Date.UTC(2026, 3, 11, 12, 42, 0);
		return mkEntry({
			questId: 'q1',
			type: 'supply',
			facilityId: 'loc-market',
			itemId: 'food',
			quantity: 3,
			reward: 15,
			createdTick: 5,
			expiryTick: 105,
			state: 'completed',
			claimedBy: 'agent-bram',
			claimedTick: 10,
			firstClaimedBy: 'agent-bram',
			firstClaimedTick: 10,
			firstClaimedAt: createdMs + 30_000,
			claimers: ['agent-bram'],
			resolvedTick: 25,
			resolution: 'completed',
			timeline: [
				{ tick: 5, wallClock: createdMs, type: 'QuestGenerated', message: 'Generated supply quest at Market Stall · 15g reward' },
				{ tick: 10, wallClock: createdMs + 30_000, type: 'QuestClaimed', message: 'Claimed by Bram' },
				{ tick: 25, wallClock: resolvedMs, type: 'QuestCompleted', message: 'Completed by Bram (+15g)' },
			],
		});
	}

	function parseFrontmatter(md: string): Record<string, string> {
		const match = /^---\n([\s\S]*?)\n---\n/.exec(md);
		if (match === null) throw new Error('No frontmatter block found');
		const result: Record<string, string> = {};
		let currentKey: string | null = null;
		const listValues: string[] = [];
		for (const line of match[1]!.split('\n')) {
			const listMatch = /^\s+-\s+(.*)$/.exec(line);
			if (listMatch !== null && currentKey !== null) {
				listValues.push(listMatch[1]!);
				result[currentKey] = listValues.join(',');
				continue;
			}
			const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
			if (kv !== null) {
				currentKey = kv[1]!;
				if (kv[2] === '') {
					// list start — reset collector
					listValues.length = 0;
					result[currentKey] = '';
				} else {
					result[currentKey] = kv[2]!;
					currentKey = null;
				}
			}
		}
		return result;
	}

	it('produces valid frontmatter with all declared fields', () => {
		const md = serializeQuest(completedSupplyQuest(), resolveName);
		expect(md.startsWith('---\n')).toBe(true);
		expect(md).toMatch(/\n---\n/);

		const fm = parseFrontmatter(md);
		expect(fm['id']).toBe('q1');
		expect(fm['quest_type']).toBe('supply');
		expect(fm['state']).toBe('completed');
		expect(fm['resolution']).toBe('completed');
		expect(fm['facility']).toBe('Market Stall');
		expect(fm['facility_id']).toBe('loc-market');
		expect(fm['item']).toBe('food');
		expect(fm['quantity']).toBe('3');
		expect(fm['reward']).toBe('15');
		expect(fm['created_tick']).toBe('5');
		expect(fm['claimed_tick']).toBe('10');
		expect(fm['resolved_tick']).toBe('25');
		expect(fm['duration_ticks']).toBe('20');
		expect(fm['claimed_by']).toBe('Bram');
		expect(fm['claimed_by_id']).toBe('agent-bram');
		expect(fm['timeline_events']).toBe('3');
		// Tags include baseline facets plus derived stage/outcome/size/SLA facets
		const tagSet = new Set(fm['tags']!.split(','));
		expect(tagSet).toContain('quest');
		expect(tagSet).toContain('quest/supply');
		expect(tagSet).toContain('quest/completed');
		expect(tagSet).toContain('quest/stage/done');
		expect(tagSet).toContain('quest/outcome/success');
		expect(tagSet).toContain('quest/size/small'); // cycle time 15 → small
		expect(tagSet).toContain('quest/sla/met');    // resolved at t25, expiry at t105
	});

	it('emits ISO 8601 datetime for created_at and resolved_at', () => {
		const md = serializeQuest(completedSupplyQuest(), resolveName);
		const fm = parseFrontmatter(md);
		expect(fm['created_at']).toBe('2026-04-11T12:39:00');
		expect(fm['resolved_at']).toBe('2026-04-11T12:42:00');
	});

	it('emits null for all nullable fields when a quest is still open', () => {
		const entry = mkEntry({
			questId: 'q1',
			type: 'repair',
			facilityId: 'loc-workshop',
			reward: 20,
			createdTick: 0,
			timeline: [{ tick: 0, wallClock: Date.UTC(2026, 0, 1), type: 'QuestGenerated', message: 'Generated' }],
		});
		const md = serializeQuest(entry, resolveName);
		const fm = parseFrontmatter(md);
		expect(fm['resolution']).toBe('null');
		expect(fm['item']).toBe('null');
		expect(fm['quantity']).toBe('null');
		expect(fm['claimed_tick']).toBe('null');
		expect(fm['resolved_tick']).toBe('null');
		expect(fm['duration_ticks']).toBe('null');
		expect(fm['claimed_by']).toBe('null');
		expect(fm['claimed_by_id']).toBe('null');
		expect(fm['resolved_at']).toBe('null');
		expect(fm['lead_time_ticks']).toBe('null');
		expect(fm['queue_time_ticks']).toBe('null');
		expect(fm['cycle_time_ticks']).toBe('null');
		expect(fm['wait_ratio']).toBe('null');
		expect(fm['reward_per_tick']).toBe('null');
		expect(fm['met_sla']).toBe('null');
		expect(fm['size']).toBe('null');
		expect(fm['reclaim_count']).toBe('0');
		expect(fm['touched_by_count']).toBe('0');
		expect(fm['stage']).toBe('waiting');
		expect(fm['outcome']).toBe('pending');
	});

	it('emits the active-stage tag for unresolved quests', () => {
		const entry = mkEntry({
			questId: 'q1',
			type: 'supply',
			facilityId: 'loc-market',
			itemId: 'food',
			quantity: 1,
			reward: 10,
			createdTick: 0,
			state: 'claimed',
			claimedBy: 'agent-bram',
			claimedTick: 5,
			firstClaimedBy: 'agent-bram',
			firstClaimedTick: 5,
			firstClaimedAt: Date.UTC(2026, 0, 1),
			claimers: ['agent-bram'],
			timeline: [{ tick: 0, wallClock: Date.UTC(2026, 0, 1), type: 'QuestGenerated', message: 'Generated' }],
		});
		const fm = parseFrontmatter(serializeQuest(entry, resolveName));
		// Expect baseline + stage/outcome tags for an active claimed quest
		expect(fm['tags']).toContain('quest');
		expect(fm['tags']).toContain('quest/supply');
		expect(fm['tags']).toContain('quest/claimed');
		expect(fm['tags']).toContain('quest/stage/active');
		expect(fm['tags']).toContain('quest/outcome/pending');
	});

	it('quotes YAML strings with special characters', () => {
		const specialResolve = (id: string): string => id === 'loc-weird' ? "Bob's: Workshop" : id;
		const entry = mkEntry({
			questId: 'q1',
			type: 'repair',
			facilityId: 'loc-weird',
			createdTick: 0,
			state: 'completed',
			resolvedTick: 5,
			resolution: 'completed',
			timeline: [
				{ tick: 0, wallClock: Date.UTC(2026, 0, 1), type: 'QuestGenerated', message: 'Generated' },
				{ tick: 5, wallClock: Date.UTC(2026, 0, 1), type: 'QuestCompleted', message: 'Completed' },
			],
		});
		const md = serializeQuest(entry, specialResolve);
		// The "Bob's: Workshop" string contains a colon followed by space — must be quoted
		expect(md).toContain('facility: "Bob\'s: Workshop"');
	});

	it('keeps the human-readable markdown body after the frontmatter', () => {
		const md = serializeQuest(completedSupplyQuest(), resolveName);
		expect(md).toContain('# Quest q1');
		expect(md).toContain('**Type**: supply');
		expect(md).toContain('**Target**: Market Stall');
		expect(md).toContain('**Item**: foodx3');
		expect(md).toContain('**Claimed by**: Bram');
		expect(md).toContain('## Timeline');
		expect(md).toContain('**t5**');
		expect(md).toContain('**t10**');
		expect(md).toContain('**t25**');
	});

	it('shows "(no events recorded)" for empty timeline', () => {
		const entry = mkEntry({
			questId: 'q1',
			type: 'supply',
			facilityId: 'loc-market',
			createdTick: 0,
		});
		const md = serializeQuest(entry, resolveName);
		expect(md).toContain('(no events recorded)');
		// Empty timeline → created_at is null
		const fm = parseFrontmatter(md);
		expect(fm['created_at']).toBe('null');
	});
});

describe('computeFlowMetrics', () => {
	it('classifies an open quest as waiting/pending with null metrics', () => {
		const m = computeFlowMetrics(mkEntry({ questId: 'q1', type: 'supply', facilityId: 'loc-market', createdTick: 0 }));
		expect(m.stage).toBe('waiting');
		expect(m.outcome).toBe('pending');
		expect(m.leadTimeTicks).toBeNull();
		expect(m.queueTimeTicks).toBeNull();
		expect(m.cycleTimeTicks).toBeNull();
		expect(m.waitRatio).toBeNull();
		expect(m.rewardPerTick).toBeNull();
		expect(m.metSla).toBeNull();
		expect(m.size).toBeNull();
	});

	it('classifies a claimed-but-not-done quest as active', () => {
		const m = computeFlowMetrics(mkEntry({
			questId: 'q1', type: 'supply', facilityId: 'loc-market', createdTick: 0,
			state: 'claimed', firstClaimedTick: 5, claimedTick: 5, firstClaimedBy: 'agent-bram', claimedBy: 'agent-bram',
		}));
		expect(m.stage).toBe('active');
		expect(m.outcome).toBe('pending');
	});

	it('computes lead/queue/cycle time for a straight-through completed quest', () => {
		const m = computeFlowMetrics(mkEntry({
			questId: 'q1', type: 'supply', facilityId: 'loc-market',
			reward: 30, createdTick: 10,
			firstClaimedTick: 20, claimedTick: 20,
			resolvedTick: 100, resolution: 'completed', state: 'completed',
		}));
		expect(m.leadTimeTicks).toBe(90);  // 100 - 10
		expect(m.queueTimeTicks).toBe(10); // 20 - 10
		expect(m.cycleTimeTicks).toBe(80); // 100 - 20
		expect(m.waitRatio).toBeCloseTo(10 / 90, 4);
		expect(m.rewardPerTick).toBeCloseTo(30 / 80, 4);
		expect(m.outcome).toBe('success');
		expect(m.stage).toBe('done');
	});

	it('classifies size by cycle time', () => {
		function sizeForCycle(cycle: number): string | null {
			return computeFlowMetrics(mkEntry({
				questId: 'q', type: 'repair', facilityId: 'loc-x',
				createdTick: 0, firstClaimedTick: 0, claimedTick: 0,
				resolvedTick: cycle, resolution: 'completed', state: 'completed',
			})).size;
		}
		expect(sizeForCycle(30)).toBe('small');
		expect(sizeForCycle(60)).toBe('small');
		expect(sizeForCycle(61)).toBe('medium');
		expect(sizeForCycle(240)).toBe('medium');
		expect(sizeForCycle(241)).toBe('large');
		expect(sizeForCycle(600)).toBe('large');
		expect(sizeForCycle(601)).toBe('xl');
		expect(sizeForCycle(5000)).toBe('xl');
	});

	it('metSla is true for on-time completions, false for expired quests', () => {
		const onTime = computeFlowMetrics(mkEntry({
			questId: 'q1', type: 'supply', facilityId: 'loc-market',
			createdTick: 0, expiryTick: 100,
			firstClaimedTick: 5, claimedTick: 5,
			resolvedTick: 50, resolution: 'completed', state: 'completed',
		}));
		expect(onTime.metSla).toBe(true);

		const expired = computeFlowMetrics(mkEntry({
			questId: 'q2', type: 'supply', facilityId: 'loc-market',
			createdTick: 0, expiryTick: 100,
			resolvedTick: 120, resolution: 'expired', state: 'expired',
		}));
		expect(expired.metSla).toBe(false);
	});

	it('metSla is null when expiry_tick is missing', () => {
		const m = computeFlowMetrics(mkEntry({
			questId: 'q1', type: 'supply', facilityId: 'loc-market',
			createdTick: 0,
			firstClaimedTick: 5, claimedTick: 5,
			resolvedTick: 50, resolution: 'completed', state: 'completed',
		}));
		expect(m.metSla).toBeNull();
	});

	it('metSla is false when completion happens past expiry', () => {
		const m = computeFlowMetrics(mkEntry({
			questId: 'q1', type: 'repair', facilityId: 'loc-x',
			createdTick: 0, expiryTick: 50,
			firstClaimedTick: 10, claimedTick: 10,
			resolvedTick: 60, resolution: 'completed', state: 'completed',
		}));
		expect(m.metSla).toBe(false);
		expect(m.outcome).toBe('success'); // still counts as completed, just missed SLA
	});

	it('rewardPerTick is null for non-success outcomes', () => {
		const m = computeFlowMetrics(mkEntry({
			questId: 'q1', type: 'repair', facilityId: 'loc-x',
			reward: 50, createdTick: 0, expiryTick: 100,
			firstClaimedTick: 10, claimedTick: 10,
			resolvedTick: 30, resolution: 'abandoned', state: 'abandoned',
		}));
		expect(m.rewardPerTick).toBeNull();
	});

	it('rewardPerTick handles zero cycle time safely', () => {
		const m = computeFlowMetrics(mkEntry({
			questId: 'q1', type: 'supply', facilityId: 'loc-market',
			reward: 10, createdTick: 0,
			firstClaimedTick: 5, claimedTick: 5,
			resolvedTick: 5, resolution: 'completed', state: 'completed',
		}));
		expect(m.cycleTimeTicks).toBe(0);
		expect(m.rewardPerTick).toBeNull(); // guard against divide-by-zero
	});
});

describe('serializeQuest — flow metrics integration', () => {
	it('emits flow metrics fields with correct values for a completed quest', () => {
		const createdMs = Date.UTC(2026, 3, 11, 12, 0, 0);
		const firstClaimedMs = createdMs + 10_000;
		const resolvedMs = createdMs + 120_000;
		const entry = mkEntry({
			questId: 'q1', type: 'supply', facilityId: 'loc-market',
			itemId: 'food', quantity: 5,
			reward: 100, createdTick: 0, expiryTick: 200,
			firstClaimedTick: 20, claimedTick: 20,
			firstClaimedBy: 'agent-bram', claimedBy: 'agent-bram',
			firstClaimedAt: firstClaimedMs,
			claimers: ['agent-bram'],
			resolvedTick: 100, resolution: 'completed', state: 'completed',
			timeline: [
				{ tick: 0, wallClock: createdMs, type: 'QuestGenerated', message: 'Generated' },
				{ tick: 20, wallClock: firstClaimedMs, type: 'QuestClaimed', message: 'Claimed by Bram' },
				{ tick: 100, wallClock: resolvedMs, type: 'QuestCompleted', message: 'Completed by Bram (+100g)' },
			],
		});
		const md = serializeQuest(entry, resolveName);
		// Parse the frontmatter using a local helper
		const fm = Object.fromEntries(
			md.split('\n---\n')[0]!.split('\n').slice(1)
				.map(l => /^([a-z_]+):\s*(.*)$/.exec(l))
				.filter((m): m is RegExpExecArray => m !== null)
				.map(m => [m[1], m[2]]),
		);

		expect(fm['stage']).toBe('done');
		expect(fm['outcome']).toBe('success');
		expect(fm['lead_time_ticks']).toBe('100');
		expect(fm['queue_time_ticks']).toBe('20');
		expect(fm['cycle_time_ticks']).toBe('80');
		expect(fm['wait_ratio']).toBe('0.2000');
		expect(fm['reward_per_tick']).toBe('1.2500');
		expect(fm['met_sla']).toBe('true');
		expect(fm['size']).toBe('medium');
		expect(fm['reclaim_count']).toBe('0');
		expect(fm['touched_by_count']).toBe('1');
		expect(fm['first_claimed_tick']).toBe('20');
		expect(fm['first_claimed_by']).toBe('Bram');
		expect(fm['first_claimed_by_id']).toBe('agent-bram');
		expect(fm['first_claimed_at']).toBe('2026-04-11T12:00:10');
		expect(fm['expiry_tick']).toBe('200');
	});

	it('emits reclaim tags and correct touched_by count for a re-claimed quest', () => {
		const createdMs = Date.UTC(2026, 3, 11, 12, 0, 0);
		const entry = mkEntry({
			questId: 'q1', type: 'supply', facilityId: 'loc-market',
			reward: 15, createdTick: 0, expiryTick: 300,
			firstClaimedTick: 10,
			firstClaimedBy: 'agent-bram',
			firstClaimedAt: createdMs + 10_000,
			claimedTick: 50, claimedBy: 'agent-alice',
			claimers: ['agent-bram', 'agent-alice'],
			reclaimCount: 1,
			resolvedTick: 100, resolution: 'completed', state: 'completed',
			timeline: [
				{ tick: 0, wallClock: createdMs, type: 'QuestGenerated', message: 'Generated' },
				{ tick: 10, wallClock: createdMs + 10_000, type: 'QuestClaimed', message: 'Claimed by Bram' },
				{ tick: 30, wallClock: createdMs + 30_000, type: 'QuestAbandoned', message: 'Abandoned by Bram (abandoned)' },
				{ tick: 50, wallClock: createdMs + 50_000, type: 'QuestClaimed', message: 'Re-claimed by Alice' },
				{ tick: 100, wallClock: createdMs + 100_000, type: 'QuestCompleted', message: 'Completed by Alice (+15g)' },
			],
		});
		const md = serializeQuest(entry, resolveName);
		expect(md).toContain('reclaim_count: 1');
		expect(md).toContain('touched_by_count: 2');
		expect(md).toContain('quest/reclaimed');
		// Queue time = 10 - 0 = 10 (from creation to FIRST claim, not reclaim)
		expect(md).toContain('queue_time_ticks: 10');
		// Cycle time = 100 - 10 = 90 (first claim to resolution, including abandon period)
		expect(md).toContain('cycle_time_ticks: 90');
		// Lead time = 100 - 0
		expect(md).toContain('lead_time_ticks: 100');
	});

	it('emits sla/met and sla/missed tags', () => {
		const onTime = mkEntry({
			questId: 'q1', type: 'supply', facilityId: 'loc-market',
			createdTick: 0, expiryTick: 100,
			firstClaimedTick: 5, claimedTick: 5,
			firstClaimedBy: 'agent-bram', claimedBy: 'agent-bram',
			claimers: ['agent-bram'],
			resolvedTick: 50, resolution: 'completed', state: 'completed',
		});
		expect(serializeQuest(onTime, resolveName)).toContain('quest/sla/met');

		const late = mkEntry({
			questId: 'q2', type: 'supply', facilityId: 'loc-market',
			createdTick: 0, expiryTick: 50,
			firstClaimedTick: 5, claimedTick: 5,
			firstClaimedBy: 'agent-bram', claimedBy: 'agent-bram',
			claimers: ['agent-bram'],
			resolvedTick: 100, resolution: 'completed', state: 'completed',
		});
		expect(serializeQuest(late, resolveName)).toContain('quest/sla/missed');
	});
});
