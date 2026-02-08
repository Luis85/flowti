/**
 * Tracks recent sync operations to prevent sync loops in bidirectional mode.
 *
 * When a file is synced forward (source → vault), VaultWatcher sees the change
 * and would try to sync it back. The detector prevents this by recording recent
 * syncs and checking against a cooldown window.
 *
 * @category Services
 */
export class SyncLoopDetector {
	/** path → timestamp of last sync */
	private recentSyncs = new Map<string, number>();

	/** Cooldown period (ms) — 5s to accommodate cloud sync delays */
	private static readonly COOLDOWN_MS = 5000;

	/** Cleanup interval (ms) */
	private static readonly CLEANUP_INTERVAL_MS = 60000;

	/** Interval handle for periodic cleanup */
	private cleanupIntervalId?: ReturnType<typeof setInterval>;

	constructor() {
		this.cleanupIntervalId = setInterval(
			() => this.cleanup(),
			SyncLoopDetector.CLEANUP_INTERVAL_MS
		);
	}

	/** Check if a file was recently synced (within cooldown window). */
	isRecentlySynced(filePath: string): boolean {
		const normalized = this.normalize(filePath);
		const lastSync = this.recentSyncs.get(normalized);
		if (!lastSync) return false;
		return Date.now() - lastSync < SyncLoopDetector.COOLDOWN_MS;
	}

	/** Record a sync operation for loop detection. */
	recordSync(filePath: string): void {
		const normalized = this.normalize(filePath);
		this.recentSyncs.set(normalized, Date.now());
	}

	/** Release resources. */
	destroy(): void {
		if (this.cleanupIntervalId) {
			clearInterval(this.cleanupIntervalId);
			this.cleanupIntervalId = undefined;
		}
		this.recentSyncs.clear();
	}

	/** Normalize path for consistent lookup (lowercase, forward slashes). */
	private normalize(filePath: string): string {
		return filePath.replace(/\\/g, "/").toLowerCase();
	}

	/** Remove entries older than 2× cooldown. */
	private cleanup(): void {
		const now = Date.now();
		for (const [p, timestamp] of this.recentSyncs.entries()) {
			if (now - timestamp > SyncLoopDetector.COOLDOWN_MS * 2) {
				this.recentSyncs.delete(p);
			}
		}
	}
}
