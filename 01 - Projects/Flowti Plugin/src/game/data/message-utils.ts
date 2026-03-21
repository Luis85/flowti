/** Strip markdown code fences and extract message from JSON agent responses. */
export function extractAgentMessage(raw: string): string {
	const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

	// Try parsing the whole thing as JSON first
	try {
		const parsed: unknown = JSON.parse(cleaned);
		if (parsed && typeof parsed === "object") {
			if ("message" in parsed) {
				const msg = (parsed as { message: unknown }).message;
				if (typeof msg === "string") return msg;
			}
			// CLI / providers may emit `response` instead of `message`
			if ("response" in parsed) {
				const resp = (parsed as { response: unknown }).response;
				if (typeof resp === "string") return resp;
			}
		}
	} catch {
		// Not pure JSON — check for mixed text + JSON
	}

	// Strip inline JSON objects from mixed text+JSON responses
	// e.g. "Got the full picture.\n\n{\"message\": \"...\", \"status\": \"ready\"}"
	const messageBlock = cleaned.match(/\n*\s*\{[\s\S]*?"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
	if (messageBlock) {
		const jsonMessage = messageBlock[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
		const beforeJson = cleaned.slice(0, messageBlock.index).trim();
		return beforeJson ? `${beforeJson}\n\n${jsonMessage}` : jsonMessage;
	}
	const responseBlock = cleaned.match(/\n*\s*\{[\s\S]*?"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
	if (responseBlock) {
		const jsonMessage = responseBlock[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
		const beforeJson = cleaned.slice(0, responseBlock.index).trim();
		return beforeJson ? `${beforeJson}\n\n${jsonMessage}` : jsonMessage;
	}

	// Strip any remaining bare JSON objects (no message field)
	const strippedJson = cleaned.replace(/\n*\s*\{[\s\S]*?"status"\s*:\s*"[^"]*"\s*\}/g, "").trim();
	if (strippedJson && strippedJson !== cleaned) return strippedJson;

	if (raw !== cleaned) return cleaned;
	return raw;
}
