/** Strip markdown code fences and extract message from JSON agent responses. */
export function extractAgentMessage(raw: string): string {
	const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

	// Try parsing the whole thing as JSON first
	try {
		const parsed: unknown = JSON.parse(cleaned);
		if (parsed && typeof parsed === "object" && "message" in parsed) {
			const msg = (parsed as { message: unknown }).message;
			if (typeof msg === "string") return msg;
		}
	} catch {
		// Not pure JSON — check for mixed text + JSON
	}

	// Strip inline JSON objects from mixed text+JSON responses
	// e.g. "Got the full picture.\n\n{\"message\": \"...\", \"status\": \"ready\"}"
	const jsonBlockPattern = /\n*\s*\{[\s\S]*?"message"\s*:\s*"((?:[^"\\]|\\.)*)"/;
	const match = cleaned.match(jsonBlockPattern);
	if (match) {
		// Extract the message field from the JSON block
		const jsonMessage = match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
		// Also keep any meaningful text before the JSON block
		const beforeJson = cleaned.slice(0, match.index).trim();
		return beforeJson ? `${beforeJson}\n\n${jsonMessage}` : jsonMessage;
	}

	// Strip any remaining bare JSON objects (no message field)
	const strippedJson = cleaned.replace(/\n*\s*\{[\s\S]*?"status"\s*:\s*"[^"]*"\s*\}/g, "").trim();
	if (strippedJson && strippedJson !== cleaned) return strippedJson;

	if (raw !== cleaned) return cleaned;
	return raw;
}
