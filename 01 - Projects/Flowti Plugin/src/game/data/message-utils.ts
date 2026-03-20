/** Strip markdown code fences and extract message from JSON agent responses. */
export function extractAgentMessage(raw: string): string {
	const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

	try {
		const parsed: unknown = JSON.parse(cleaned);
		if (parsed && typeof parsed === "object" && "message" in parsed) {
			const msg = (parsed as { message: unknown }).message;
			if (typeof msg === "string") return msg;
		}
	} catch {
		// Not JSON — use as-is
	}

	if (raw !== cleaned) return cleaned;
	return raw;
}
