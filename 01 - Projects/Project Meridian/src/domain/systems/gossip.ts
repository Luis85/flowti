import type { MemoryEntry } from '../core/component-data.js';

export interface LocationGossip {
	gossipType: 'location';
	locationId: string;
	locationType: string;
	position: { x: number; y: number };
	reliability: number;
	sourceAgentId: string;
	hopCount: number;
}

export interface ReputationGossip {
	gossipType: 'reputation';
	subjectAgentId: string;
	dispositionBias: number;
	reliability: number;
	sourceAgentId: string;
	hopCount: number;
}

export type GossipData = LocationGossip | ReputationGossip;

export interface GossipExchangeInput {
	giverGossip: { memory: MemoryEntry; data: GossipData }[];
	receiverGossip: { memory: MemoryEntry; data: GossipData }[];
	receiverIQ: number;
	reliabilityTiers: number[];
	iqFilterThreshold: number;
	minReliability: number;
	maxItemsPerExchange: number;
	currentTick: number;
}

export interface GossipExchangeResult {
	transferred: {
		memory: MemoryEntry;
		dispositionChanges: { agentId: string; change: number }[];
	}[];
}

function gossipSignificance(item: { memory: MemoryEntry; data: GossipData }): number {
	return item.memory.significance;
}

function isDuplicateLocation(data: LocationGossip, receiverGossip: { data: GossipData }[]): boolean {
	return receiverGossip.some(
		r => r.data.gossipType === 'location' && r.data.locationId === data.locationId,
	);
}

function isDuplicateReputation(data: ReputationGossip, receiverGossip: { data: GossipData }[]): boolean {
	return receiverGossip.some(
		r => r.data.gossipType === 'reputation' && r.data.subjectAgentId === data.subjectAgentId,
	);
}

function buildGossipDescription(data: GossipData, sourceAgentId: string): string {
	if (data.gossipType === 'location') {
		return `Heard from ${sourceAgentId}: there is a ${data.locationType} at (${data.position.x}, ${data.position.y})`;
	}
	const biasLabel = data.dispositionBias >= 0 ? 'positive' : 'negative';
	return `Heard from ${sourceAgentId}: ${biasLabel} reputation about ${data.subjectAgentId}`;
}

export function exchangeGossip(input: GossipExchangeInput): GossipExchangeResult {
	const sorted = [...input.giverGossip].sort((a, b) => gossipSignificance(b) - gossipSignificance(a));
	const candidates = sorted.slice(0, input.maxItemsPerExchange);

	const transferred: GossipExchangeResult['transferred'] = [];

	for (const item of candidates) {
		const newHopCount = item.data.hopCount + 1;

		if (newHopCount >= input.reliabilityTiers.length) continue;

		const newReliability = input.reliabilityTiers[newHopCount]!;

		if (newReliability < input.minReliability && input.receiverIQ >= input.iqFilterThreshold) continue;

		if (item.data.gossipType === 'location' && isDuplicateLocation(item.data, input.receiverGossip)) continue;
		if (item.data.gossipType === 'reputation' && isDuplicateReputation(item.data, input.receiverGossip)) continue;

		const dispositionChanges: { agentId: string; change: number }[] = [];

		if (item.data.gossipType === 'reputation') {
			dispositionChanges.push({
				agentId: item.data.subjectAgentId,
				change: item.data.dispositionBias * newReliability,
			});
		}

		const newData: GossipData = item.data.gossipType === 'location'
			? { ...item.data, reliability: newReliability, hopCount: newHopCount }
			: { ...item.data, reliability: newReliability, hopCount: newHopCount };

		const memory: MemoryEntry = {
			tick: input.currentTick,
			type: 'gossip',
			description: buildGossipDescription(newData, newData.sourceAgentId),
			participants: [newData.sourceAgentId],
			outcome: 'neutral',
			significance: newReliability * 5,
			mood_impact: 0,
			metadata: { ...newData },
		};

		transferred.push({ memory, dispositionChanges });
	}

	return { transferred };
}

export function parseGossipData(entry: MemoryEntry): GossipData | null {
	if (entry.type !== 'gossip') return null;
	if (entry.metadata === undefined) return null;

	const meta = entry.metadata;
	const gossipType = meta['gossipType'] as string | undefined;

	if (gossipType === 'location') {
		const pos = meta['position'] as { x: number; y: number } | undefined;
		if (
			typeof meta['locationId'] !== 'string' ||
			typeof meta['locationType'] !== 'string' ||
			pos === undefined ||
			typeof meta['reliability'] !== 'number' ||
			typeof meta['sourceAgentId'] !== 'string' ||
			typeof meta['hopCount'] !== 'number'
		) return null;
		return {
			gossipType: 'location',
			locationId: meta['locationId'] as string,
			locationType: meta['locationType'] as string,
			position: { x: pos.x, y: pos.y },
			reliability: meta['reliability'] as number,
			sourceAgentId: meta['sourceAgentId'] as string,
			hopCount: meta['hopCount'] as number,
		};
	}

	if (gossipType === 'reputation') {
		if (
			typeof meta['subjectAgentId'] !== 'string' ||
			typeof meta['dispositionBias'] !== 'number' ||
			typeof meta['reliability'] !== 'number' ||
			typeof meta['sourceAgentId'] !== 'string' ||
			typeof meta['hopCount'] !== 'number'
		) return null;
		return {
			gossipType: 'reputation',
			subjectAgentId: meta['subjectAgentId'] as string,
			dispositionBias: meta['dispositionBias'] as number,
			reliability: meta['reliability'] as number,
			sourceAgentId: meta['sourceAgentId'] as string,
			hopCount: meta['hopCount'] as number,
		};
	}

	return null;
}
