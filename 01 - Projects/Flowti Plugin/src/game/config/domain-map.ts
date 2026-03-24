import { DEFAULT_ROOM, type RoomId } from "../data/scene-configs.js";

const DEFAULT_MAP: Record<string, RoomId> = {
	engineering: "office", qa: "office", devops: "office",
	development: "office", testing: "office",
	design: "village", ux: "village", product: "village",
	management: "station", delivery: "station", coordination: "station",
	general: "hub",
};

export function resolveSettingForDomain(domain: string | undefined, custom?: Record<string, RoomId>): RoomId {
	if (!domain) return DEFAULT_ROOM;
	const merged = custom ? { ...DEFAULT_MAP, ...custom } : DEFAULT_MAP;
	return merged[domain.toLowerCase()] ?? DEFAULT_ROOM;
}
