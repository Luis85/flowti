import type { VaultOperation } from "../trust/trust-types.js";

// ── Dependency injection ──────────────────────────────────────────────

export interface VaultOpsDeps {
	readonly disk: {
		existsSync(p: string): boolean;
		readFileSync(p: string, enc: string): string;
		writeFileSync(p: string, data: string, enc?: string): void;
		mkdirSync(p: string, opts?: { recursive?: boolean }): void;
		renameSync(from: string, to: string): void;
		readdirSync(p: string, opts?: { withFileTypes?: boolean; recursive?: boolean }): unknown[];
		statSync(p: string): { mtimeMs: number };
		rmSync(p: string, opts?: { recursive?: boolean; force?: boolean }): void;
		copyFileSync(src: string, dest: string): void;
	};
	readonly clock: { iso(): string };
	readonly paths: {
		join(...segs: string[]): string;
		dirname(p: string): string;
		basename(p: string): string;
		relative(from: string, to: string): string;
	};
	readonly vaultRoot: string;
}

// ── Request types ─────────────────────────────────────────────────────

export interface VaultOpRequest {
	readonly operation: VaultOperation;
	readonly agentName: string;
	readonly taskId?: string;
}

export interface VaultReadRequest extends VaultOpRequest {
	readonly operation: "vault-read";
	readonly path: string;
}

export interface VaultSearchRequest extends VaultOpRequest {
	readonly operation: "vault-search";
	readonly query: {
		readonly tags?: readonly string[];
		readonly folder?: string;
		readonly pattern?: string;
	};
}

export interface VaultTagRequest extends VaultOpRequest {
	readonly operation: "vault-tag";
	readonly path: string;
	readonly addTags?: readonly string[];
	readonly removeTags?: readonly string[];
}

export interface VaultCreateRequest extends VaultOpRequest {
	readonly operation: "vault-create";
	readonly path: string;
	readonly frontmatter?: Record<string, unknown>;
	readonly body?: string;
}

export interface VaultEditRequest extends VaultOpRequest {
	readonly operation: "vault-edit";
	readonly path: string;
	readonly content: string;
}

export interface VaultMoveRequest extends VaultOpRequest {
	readonly operation: "vault-move";
	readonly fromPath: string;
	readonly toPath: string;
}

export interface VaultLinkRequest extends VaultOpRequest {
	readonly operation: "vault-link";
	readonly path: string;
	readonly addLinks?: readonly string[];
	readonly removeLinks?: readonly string[];
}

export type AnyVaultOpRequest =
	| VaultReadRequest
	| VaultSearchRequest
	| VaultTagRequest
	| VaultCreateRequest
	| VaultEditRequest
	| VaultMoveRequest
	| VaultLinkRequest;

// ── Result types ──────────────────────────────────────────────────────

export type VaultOpOutcome = "executed" | "staged" | "queued" | "denied" | "failed";

export interface VaultOpResult {
	readonly outcome: VaultOpOutcome;
	readonly operation: VaultOperation;
	readonly agentName: string;
	readonly taskId?: string;
	readonly data?: unknown;
	readonly stagingId?: string;
	readonly reason?: string;
}

// ── Context types ─────────────────────────────────────────────────────

export interface FolderEntry {
	readonly path: string;
	readonly noteCount: number;
}

export interface TagEntry {
	readonly tag: string;
	readonly count: number;
}

export interface RecentChange {
	readonly path: string;
	readonly action: "created" | "modified" | "deleted" | "moved";
	readonly at: string;
}

export interface VaultContext {
	readonly folderMap: readonly FolderEntry[];
	readonly tagIndex: readonly TagEntry[];
	readonly recentChanges: readonly RecentChange[];
}

export interface VaultScope {
	readonly folders?: readonly string[];
	readonly tags?: readonly string[];
}

// ── Cache types ───────────────────────────────────────────────────────

export interface FileIndexEntry {
	readonly path: string;
	readonly mtimeMs: number;
	readonly tags: readonly string[];
}

export interface VaultContextCache {
	readonly version: number;
	readonly builtAt: string;
	readonly folderMap: readonly FolderEntry[];
	readonly tagIndex: readonly TagEntry[];
	readonly fileIndex: readonly FileIndexEntry[];
}

// ── Event types ───────────────────────────────────────────────────────

export interface VaultEvent {
	readonly folder: string;
	readonly type: string;
	readonly path: string;
	readonly at: string;
}
