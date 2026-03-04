/** Slim projection of EventCatalogEntry for autocomplete display. */
export interface EventSuggestItem {
	type: string;
	category: string;
	description: string;
}

/** A scored match result for dropdown rendering. */
export interface ScoredEventItem {
	item: EventSuggestItem;
	score: number;
}
