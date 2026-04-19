/**
 * Pure relative-date formatter used by RecentInstancesList.
 *
 * Buckets:
 *   <60s           → "just now"
 *   1m–59m         → "Nm ago"
 *   1h–23h         → "Nh ago"
 *   1d–6d          → "Nd ago"
 *   7d–28d         → "Nw ago"  (1w–4w)
 *   >28d           → ISO date slice "YYYY-MM-DD"  (deterministic, locale-free)
 *   future / bad   → "just now" or ""  (see impl)
 *
 * Deterministic: relies only on Date.now() and Date.parse(). No locale.
 */
export function formatRelativeDate(iso: string): string {
	const parsed = Date.parse(iso);
	if (Number.isNaN(parsed)) return '';
	const nowMs   = Date.now();
	const deltaMs = nowMs - parsed;

	if (deltaMs < 60_000) return 'just now';

	const minutes = Math.floor(deltaMs / 60_000);
	if (minutes < 60) return `${minutes}m ago`;

	const hours = Math.floor(deltaMs / 3_600_000);
	if (hours < 24) return `${hours}h ago`;

	const days = Math.floor(deltaMs / 86_400_000);
	if (days < 7) return `${days}d ago`;

	const weeks = Math.floor(days / 7);
	if (weeks <= 4) return `${weeks}w ago`;

	return iso.slice(0, 10); // YYYY-MM-DD
}
