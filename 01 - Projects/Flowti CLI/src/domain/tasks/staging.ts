import type { VaultOperation } from "../trust/trust-types.js";

export interface StagedFile {
	readonly path: string;
	readonly action: "create" | "modify" | "tag" | "move" | "link";
	readonly previewPath: string;
}

export interface StagingManifest {
	readonly taskId: string;
	readonly agentName: string;
	readonly operation: VaultOperation;
	readonly files: readonly StagedFile[];
	readonly createdAt: string;
	readonly status: "pending" | "approved" | "rejected";
}

export type StagingDeps = {
	readonly disk: {
		existsSync(p: string): boolean;
		readFileSync(p: string, enc?: string): string;
		writeFileSync(p: string, c: string): void;
		mkdirSync(p: string, opts?: { recursive?: boolean }): void;
		readdirSync(p: string): string[];
		unlinkSync(p: string): void;
		copyFileSync?(src: string, dest: string): void;
	};
	readonly paths: { join(...segs: string[]): string; dirname(p: string): string; basename(p: string): string };
};

const STAGING_DIR = ".flowti/var/staging";

export function createStagingArea(deps: StagingDeps, vaultRoot: string, manifest: StagingManifest): string {
	const dir = deps.paths.join(vaultRoot, STAGING_DIR, manifest.taskId);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.mkdirSync(deps.paths.join(dir, "preview"), { recursive: true });
	deps.disk.writeFileSync(deps.paths.join(dir, "manifest.json"), JSON.stringify(manifest, null, "\t"));
	return dir;
}

export function readManifest(deps: StagingDeps, vaultRoot: string, taskId: string): StagingManifest | null {
	const path = deps.paths.join(vaultRoot, STAGING_DIR, taskId, "manifest.json");
	if (!deps.disk.existsSync(path)) return null;
	const raw = deps.disk.readFileSync(path, "utf-8");
	return JSON.parse(raw) as StagingManifest;
}

export function listPendingReviews(deps: StagingDeps, vaultRoot: string): StagingManifest[] {
	const dir = deps.paths.join(vaultRoot, STAGING_DIR);
	if (!deps.disk.existsSync(dir)) return [];
	const entries = deps.disk.readdirSync(dir);
	const results: StagingManifest[] = [];
	for (const entry of entries) {
		const manifest = readManifest(deps, vaultRoot, entry);
		if (manifest && manifest.status === "pending") {
			results.push(manifest);
		}
	}
	return results;
}

export function approveStaged(deps: StagingDeps, vaultRoot: string, taskId: string): StagingManifest | null {
	const manifest = readManifest(deps, vaultRoot, taskId);
	if (!manifest || manifest.status !== "pending") return null;

	// Copy preview files to their target paths in the vault
	for (const file of manifest.files) {
		const src = deps.paths.join(vaultRoot, STAGING_DIR, taskId, "preview", deps.paths.basename(file.previewPath));
		const dest = deps.paths.join(vaultRoot, file.path);
		if (deps.disk.existsSync(src)) {
			deps.disk.mkdirSync(deps.paths.dirname(dest), { recursive: true });
			if (deps.disk.copyFileSync) {
				deps.disk.copyFileSync(src, dest);
			} else {
				const content = deps.disk.readFileSync(src, "utf-8");
				deps.disk.writeFileSync(dest, content);
			}
		}
	}

	// Update manifest status
	const updated: StagingManifest = { ...manifest, status: "approved" };
	deps.disk.writeFileSync(
		deps.paths.join(vaultRoot, STAGING_DIR, taskId, "manifest.json"),
		JSON.stringify(updated, null, "\t"),
	);
	return updated;
}

export function rejectStaged(deps: StagingDeps, vaultRoot: string, taskId: string): StagingManifest | null {
	const manifest = readManifest(deps, vaultRoot, taskId);
	if (!manifest || manifest.status !== "pending") return null;

	const updated: StagingManifest = { ...manifest, status: "rejected" };
	deps.disk.writeFileSync(
		deps.paths.join(vaultRoot, STAGING_DIR, taskId, "manifest.json"),
		JSON.stringify(updated, null, "\t"),
	);
	return updated;
}
