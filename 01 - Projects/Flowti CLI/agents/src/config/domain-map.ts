import type { Setting } from "../data/types.js";

const DEFAULT_MAP: Record<string, Setting> = {
	engineering: "office", qa: "office", devops: "office",
	development: "office", testing: "office",
	design: "village", ux: "village", product: "village",
	management: "station", delivery: "station", coordination: "station",
	general: "hub",
};

export function resolveSettingForDomain(domain: string | undefined, custom?: Record<string, Setting>): Setting {
	if (!domain) return "hub";
	const merged = custom ? { ...DEFAULT_MAP, ...custom } : DEFAULT_MAP;
	return merged[domain.toLowerCase()] ?? "hub";
}
