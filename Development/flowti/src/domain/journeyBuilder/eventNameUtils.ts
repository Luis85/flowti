/**
 * Converts human-readable "Title Sentence" input to dot-notation event names.
 *
 * - "Session Started"          → "session.started"
 * - "Hub Tab Changed"          → "hub.tab.changed"
 * - "Journey-Builder Opened"   → "journey-builder.opened"
 * - "journey-builder.opened"   → "journey-builder.opened" (passthrough)
 * - ""                         → ""
 */
export function toEventName(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return "";

	// Already dot-notation: contains dots but no spaces → passthrough
	if (trimmed.includes(".") && !trimmed.includes(" ")) {
		return trimmed.toLowerCase();
	}

	// Title Sentence: lowercase, split on whitespace, join with dots
	return trimmed.toLowerCase().split(/\s+/).join(".");
}

/** Returns true if conversion changed the value (Title Sentence was entered). */
export function isEventNameConverted(raw: string, converted: string): boolean {
	return raw.trim() !== "" && raw.trim() !== converted;
}
