/**
 * fuzzyMatchEvent — pure scoring and filtering for event autocomplete.
 *
 * Scores event types against a query using subsequence matching with
 * bonuses for segment-boundary hits (after dots) and consecutive chars.
 */
import type { EventSuggestItem, ScoredEventItem } from "./EventSuggestTypes";

/**
 * Scores how well `query` matches `eventType`.
 * Returns 0 for no match. Higher = better.
 *
 * Tiers: exact (1000) > prefix (500) > segment-prefix (200–400) > subsequence (10–100)
 */
export function scoreEvent(query: string, eventType: string): number {
	const q = query.toLowerCase();
	const t = eventType.toLowerCase();

	if (q === t) return 1000;
	if (t.startsWith(q)) return 500 + q.length;

	// Segment-prefix: each segment starts after a dot
	const segments = t.split(".");
	let segmentScore = 0;
	for (const seg of segments) {
		if (seg.startsWith(q)) {
			segmentScore = Math.max(segmentScore, 300 + q.length);
		}
	}
	if (segmentScore > 0) return segmentScore;

	// Subsequence match with bonuses
	let qi = 0;
	let consecutive = 0;
	let score = 0;

	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			qi++;
			consecutive++;
			// Bonus for segment boundary (first char or right after a dot)
			if (ti === 0 || t[ti - 1] === ".") {
				score += 20;
			}
			// Bonus for consecutive matches
			score += consecutive * 2;
		} else {
			consecutive = 0;
		}
	}

	// All query chars must be consumed
	if (qi < q.length) return 0;

	return Math.max(score, 10);
}

/**
 * Filters and ranks event items by query.
 * Empty query returns first `limit` items alphabetically.
 */
export function filterEvents(
	items: EventSuggestItem[],
	query: string,
	limit: number,
): ScoredEventItem[] {
	const q = query.trim();
	if (!q) {
		return items
			.slice()
			.sort((a, b) => a.type.localeCompare(b.type))
			.slice(0, limit)
			.map((item) => ({ item, score: 0 }));
	}

	const scored: ScoredEventItem[] = [];
	for (const item of items) {
		const score = scoreEvent(q, item.type);
		if (score > 0) {
			scored.push({ item, score });
		}
	}

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, limit);
}
