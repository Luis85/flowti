import { App, TFile, TFolder, WorkspaceLeaf } from "obsidian";

export function checkActiveView(): string | undefined {
	const { workspace } = this.app;
	const leaf: WorkspaceLeaf | null = workspace.activeLeaf;
	return leaf?.view.getViewType()
}

export function slugify(input: string): string {
	return String(input || "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9-_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/(^-|-$)/g, "")
		.toLowerCase();
}

export async function ensureFolder(app: App, path: string): Promise<TFolder> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFolder) return existing;

	const parts = path.split("/").filter(Boolean);
	let current = "";
	for (const p of parts) {
		current = current ? `${current}/${p}` : p;
		const e = app.vault.getAbstractFileByPath(current);
		if (!e) await app.vault.createFolder(current);
	}
	return app.vault.getAbstractFileByPath(path) as TFolder;
}

export async function upsertFile(
	app: App,
	path: string,
	content: string
): Promise<TFile> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
		return existing;
	}
	return await app.vault.create(path, content);
}

export type IngestContext = {
	cacheKey: string; // z.B. "drivers_2024"
	noteEntityKey?: string; // z.B. "drivers" (nur wenn Stamm-Entität)
	season?: number; // z.B. 2024
	kind: "entity" | "standings" | "laps" | "unknown";
};

export function resolveIngestContext(cacheKey: string): IngestContext {
	const m = /^(.+?)(?:_(\d{4,}))?$/.exec(cacheKey);
	const base = (m?.[1] ?? cacheKey).toLowerCase();
	const param = m?.[2] ? Number(m[2]) : undefined;
	const season = param && param < 10000 ? param : undefined;

	// Standings are not master entities -> don't create individual notes
	if (base.endsWith("standings")) {
		return { cacheKey, kind: "standings", season };
	}

	// Laps are manual trigger data -> don't auto-create notes
	if (base === "laps") {
		return { cacheKey, kind: "laps", season };
	}

	// Master entities that generate notes
	const masterEntities = [
		"drivers",
		"constructors",
		"circuits",
		"races",
		"seasons",
		"meetings",
		"sessions",
	];

	if (masterEntities.includes(base)) {
		return { cacheKey, noteEntityKey: base, kind: "entity", season };
	}

	return { cacheKey, kind: "unknown", season };
}
